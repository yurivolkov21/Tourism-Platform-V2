import { request as httpRequest } from 'node:http';
import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { simulateReadableStream, type UIMessage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { configureHttp, createFastifyAdapter } from '../../bootstrap.js';
import { corsOrigins } from '../../config/env.js';
import { BookingStatus, ChatRole, EmailType } from '../../generated/prisma/enums.js';
import { sessionCookie } from '../../test/session-cookie.js';
import { ChatService } from './chat.service.js';
import { CHAT_CONFIG, CHAT_LANGUAGE_MODEL, type ChatConfig } from './chat-config.js';
import { ENQUIRY_CANCELLED_REASON, ENQUIRY_SKIPPED_REASON } from './chat-history.js';

/**
 * Integration P6 (Docker PG, db tourism_test). Model là `MockLanguageModelV4` chạy
 * theo kịch bản từng lượt — không bao giờ gọi Anthropic. Mỗi ca kiểm cả HTTP lẫn
 * hàng trong DB, vì hợp đồng của trợ lý nằm ở cái được GHI (trần ngày cộng token đã
 * ghi, lịch sử là thứ được phát lại cho model).
 */

type DoStream = NonNullable<
  NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>['doStream']
>;
type StreamResult = Awaited<ReturnType<Extract<DoStream, (...args: never[]) => unknown>>>;
type StreamPart = StreamResult['stream'] extends ReadableStream<infer P> ? P : never;
type CallOptions = Parameters<Extract<DoStream, (...args: never[]) => unknown>>[0];

/** Kịch bản: mỗi phần tử là một lần gọi model; `'throw'` là model ném lỗi trước stream. */
let script: Array<StreamPart[] | 'throw'> = [];
let chunkDelayInMs: number | null = null;
const calls: CallOptions[] = [];

const model = new MockLanguageModelV4({
  provider: 'anthropic.messages',
  modelId: 'claude-haiku-4-5',
  doStream: async (options) => {
    calls.push(options);
    const next = script.shift();
    if (next === undefined) throw new Error('mock model: no scripted response left');
    if (next === 'throw') throw new Error('mock model: overloaded');
    return { stream: simulateReadableStream({ chunks: next, chunkDelayInMs }) };
  },
});

const config: ChatConfig = { enabled: true, model: 'claude-haiku-4-5', budgetUsd: 1 };

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

function textReply(text: string, tokens = usage(1000, 50), deltas = 1): StreamPart[] {
  const words = Array.from({ length: deltas }, (_, i) => (i === 0 ? text : ` ${i}`));
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 't1' },
    ...words.map((delta): StreamPart => ({ type: 'text-delta', id: 't1', delta })),
    { type: 'text-end', id: 't1' },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: tokens },
  ];
}

function toolCall(toolName: string, input: unknown, toolCallId = 'call-1'): StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    {
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: 'tool_use' },
      usage: usage(800, 40),
    },
  ];
}

type Chunk = { type: string } & Record<string, unknown>;

function sseChunks(body: string): Chunk[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)) as Chunk);
}

let app: NestFastifyApplication;
let chatService: ChatService;
let ipCounter = 0;
/** Mỗi request một IP riêng để trần 20 lượt/giờ không dính chéo giữa các ca. */
const nextIp = () => {
  ipCounter += 1;
  return `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const PASSWORD = 'chat-int-password-1';
let ownerCookie: string;
let otherCookie: string;
let ownerId: string;
let otherId: string;

function post(body: unknown, opts: { ip?: string; cookie?: string; origin?: string } = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/chat',
    remoteAddress: opts.ip ?? nextIp(),
    headers: {
      'content-type': 'application/json',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.origin ? { origin: opts.origin } : {}),
    },
    payload: JSON.stringify(body),
  });
}

const say = (conversationId: string, text: string, extra: Record<string, unknown> = {}) =>
  ({ conversationId, input: { type: 'message', text }, ...extra }) as const;
const decide = (conversationId: string, approvalId: string, approved: boolean) => ({
  conversationId,
  input: { type: 'approval', approvalId, approved },
});

/** Nhánh server ghi tin SAU khi nhánh của khách đã đóng: chờ cột giữ lượt về null. */
async function waitForTurnEnd(conversationId: string) {
  for (let i = 0; i < 100; i += 1) {
    const row = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { turnStartedAt: true },
    });
    if (row && row.turnStartedAt === null) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`turn ${conversationId} never ended`);
}

async function rows(conversationId: string) {
  return prisma.chatMessage.findMany({ where: { conversationId }, orderBy: { seq: 'asc' } });
}

let n = 0;
/** uuid v4 hợp lệ, khác nhau mỗi lần gọi. */
const newId = () => {
  n += 1;
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
};

beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CHAT_CONFIG)
    .useValue(config)
    .overrideProvider(CHAT_LANGUAGE_MODEL)
    .useValue(model)
    .compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  // CORS và helmet sống ở configureHttp — cần nó để canh header trên response stream.
  await configureHttp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  chatService = moduleRef.get(ChatService);

  const cookies: string[] = [];
  for (const email of ['chat-owner@tourism.test', 'chat-other@tourism.test']) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'Chat User' },
    });
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    cookies.push(
      sessionCookie(
        await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          payload: { email, password: PASSWORD },
        }),
      ),
    );
  }
  [ownerCookie = '', otherCookie = ''] = cookies;
  ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: 'chat-owner@tourism.test' } }))
    .id;
  otherId = (await prisma.user.findUniqueOrThrow({ where: { email: 'chat-other@tourism.test' } }))
    .id;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE chat_conversations, enquiries, outbox, tours, tour_categories, destinations RESTART IDENTITY CASCADE',
  );
  script = [];
  chunkDelayInMs = null;
  calls.length = 0;
  config.enabled = true;
  config.budgetUsd = 1;
  // Danh sách slug trong prompt được nhớ 5 phút; mỗi ca truncate catalog nên phải quên.
  Reflect.set(chatService, 'promptOptions', undefined);
});

async function seedTour() {
  const category = await prisma.tourCategory.create({
    data: { slug: 'food', name: 'Food', order: 1 },
  });
  const destination = await prisma.destination.create({ data: { slug: 'hue', name: 'Hue' } });
  const tour = await prisma.tour.create({
    data: {
      slug: 'hue-food-walk',
      title: 'Hue Food Walk',
      summary: 'Street food at dusk',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '45.00',
      currency: 'USD',
      isPublished: true,
    },
  });
  await prisma.tourDestination.create({
    data: { tourId: tour.id, destinationId: destination.id, isPrimary: true },
  });
  const start = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 2, 10));
  await prisma.tourDeparture.create({
    data: { tourId: tour.id, startDate: start, endDate: start, seatsTotal: 10, seatsBooked: 3 },
  });
  return tour;
}

describe('chat (int)', () => {
  it('lượt thường: stream câu trả lời, ghi tin khách seq 1 và tin trả lời seq 2 kèm token', async () => {
    const id = newId();
    script = [textReply('Hello from Nexora!', usage(1200, 60))];

    const res = await post(say(id, 'Hi there'));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
    const text = sseChunks(res.body)
      .filter((c) => c.type === 'text-delta')
      .map((c) => c.delta)
      .join('');
    expect(text).toBe('Hello from Nexora!');

    await waitForTurnEnd(id);
    const saved = await rows(id);
    expect(saved.map((r) => [r.seq, r.role])).toEqual([
      [1, ChatRole.USER],
      [2, ChatRole.ASSISTANT],
    ]);
    expect(saved[0]?.inputTokens).toBeNull();
    expect(saved[1]).toMatchObject({ inputTokens: 1200, outputTokens: 60 });
    const reply = saved[1]?.payload as unknown as UIMessage;
    expect(reply.role).toBe('assistant');
    expect(reply.parts).toContainEqual(expect.objectContaining({ type: 'text' }));

    // Prompt hệ thống đi kèm, lịch sử gửi model đúng một tin khách.
    expect(calls[0]?.prompt[0]).toMatchObject({ role: 'system' });
    expect(calls[0]?.prompt.filter((m) => m.role === 'user')).toHaveLength(1);

    // GET :id phát lại đúng hai tin.
    const history = await app.inject({ method: 'GET', url: `/api/chat/${id}` });
    expect(history.statusCode).toBe(200);
    expect(history.json().messages).toHaveLength(2);
  });

  it('lượt hai mang lịch sử lượt một vào model và chạm updated_at', async () => {
    const id = newId();
    script = [textReply('First'), textReply('Second')];
    await post(say(id, 'One'));
    await waitForTurnEnd(id);
    const before = await prisma.chatConversation.findUniqueOrThrow({ where: { id } });

    await post(say(id, 'Two'));
    await waitForTurnEnd(id);
    expect((await rows(id)).map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(calls[1]?.prompt.filter((m) => m.role !== 'system')).toHaveLength(3);
    const after = await prisma.chatConversation.findUniqueOrThrow({ where: { id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('GET /api/chat: cờ bật và chưa chạm trần → available', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/chat', remoteAddress: nextIp() });
    expect(res.json()).toEqual({ available: true });
  });

  it('cờ tắt → GET báo không sẵn sàng, POST 503 CHAT_UNAVAILABLE, không gọi model', async () => {
    config.enabled = false;
    expect(
      (await app.inject({ method: 'GET', url: '/api/chat', remoteAddress: nextIp() })).json(),
    ).toEqual({ available: false });
    const res = await post(say(newId(), 'Hi'));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'CHAT_UNAVAILABLE', status: 503 });
    expect(calls).toHaveLength(0);
  });

  it('tổng token hôm nay chạm trần ngày → 503, không gọi model', async () => {
    const old = newId();
    await prisma.chatConversation.create({ data: { id: old } });
    // 0,6 USD vào + 0,5 USD ra = 1,1 USD ≥ trần 1 USD.
    await prisma.chatMessage.create({
      data: {
        conversationId: old,
        seq: 1,
        role: ChatRole.ASSISTANT,
        payload: {},
        inputTokens: 600_000,
        outputTokens: 100_000,
      },
    });
    expect(
      (await app.inject({ method: 'GET', url: '/api/chat', remoteAddress: nextIp() })).json(),
    ).toEqual({ available: false });
    const res = await post(say(newId(), 'Hi'));
    expect(res.statusCode).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('token của hôm qua (UTC) không tính vào trần hôm nay', async () => {
    const old = newId();
    await prisma.chatConversation.create({ data: { id: old } });
    await prisma.chatMessage.create({
      data: {
        conversationId: old,
        seq: 1,
        role: ChatRole.ASSISTANT,
        payload: {},
        inputTokens: 5_000_000,
        outputTokens: 0,
        createdAt: new Date(Date.now() - 26 * 3_600_000),
      },
    });
    expect(
      (await app.inject({ method: 'GET', url: '/api/chat', remoteAddress: nextIp() })).json(),
    ).toEqual({ available: true });
  });

  it('đủ 20 tin khách → 409 CHAT_TURN_LIMIT, cột giữ lượt được nhả', async () => {
    const id = newId();
    await prisma.chatConversation.create({ data: { id } });
    await prisma.chatMessage.createMany({
      data: Array.from({ length: 40 }, (_, i) => ({
        conversationId: id,
        seq: i + 1,
        role: i % 2 === 0 ? ChatRole.USER : ChatRole.ASSISTANT,
        payload: {
          id: `m${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          parts: [{ type: 'text', text: 'x' }],
        },
      })),
    });
    const res = await post(say(id, 'one more'));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'CHAT_TURN_LIMIT' });
    expect(calls).toHaveLength(0);
    const conversation = await prisma.chatConversation.findUniqueOrThrow({ where: { id } });
    expect(conversation.turnStartedAt).toBeNull();
  });

  it('lượt trước còn giữ → 409 CHAT_BUSY; giữ quá 2 phút → coi như chết, chạy được', async () => {
    const id = newId();
    await prisma.chatConversation.create({ data: { id, turnStartedAt: new Date() } });
    const busy = await post(say(id, 'Hi'));
    expect(busy.statusCode).toBe(409);
    expect(busy.json()).toMatchObject({ code: 'CHAT_BUSY' });

    await prisma.chatConversation.update({
      where: { id },
      data: { turnStartedAt: new Date(Date.now() - 3 * 60_000) },
    });
    script = [textReply('Back again')];
    const res = await post(say(id, 'Hi'));
    expect(res.statusCode).toBe(200);
    await waitForTurnEnd(id);
    expect(await rows(id)).toHaveLength(2);
  });

  it('21 POST một giờ từ một IP → 429 (trần đếm cả request hỏng)', async () => {
    const ip = '10.99.0.1';
    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push((await post({ conversationId: 'not-a-uuid' }, { ip })).statusCode);
    }
    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('body sai schema → 400 INVALID_INPUT dạng envelope', async () => {
    const res = await post({ conversationId: newId(), input: { type: 'message', text: '   ' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      defined: false,
      code: 'INVALID_INPUT',
      status: 400,
      message: 'Invalid chat request',
      data: null,
    });
  });

  it('model lỗi trước khi stream bắt đầu → 503 JSON, không ghi gì, nhả lượt', async () => {
    const id = newId();
    script = ['throw'];
    const res = await post(say(id, 'Hi'));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    expect(await rows(id)).toHaveLength(0);
    const conversation = await prisma.chatConversation.findUniqueOrThrow({ where: { id } });
    expect(conversation.turnStartedAt).toBeNull();
  });

  it('lỗi GIỮA stream → khách nhận chunk lỗi, lượt không được ghi', async () => {
    const id = newId();
    script = [
      [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Half' },
        { type: 'error', error: new Error('connection reset') },
      ],
    ];
    const res = await post(say(id, 'Hi'));
    expect(res.statusCode).toBe(200);
    expect(sseChunks(res.body).some((c) => c.type === 'error')).toBe(true);
    await waitForTurnEnd(id);
    expect(await rows(id)).toHaveLength(0);
  });

  describe('hội thoại gắn tài khoản', () => {
    it('chủ đọc được; phiên khác hay không phiên → 404 cho cả GET lẫn POST', async () => {
      const id = newId();
      script = [textReply('Hi member')];
      await post(say(id, 'Hello'), { cookie: ownerCookie });
      await waitForTurnEnd(id);
      expect((await prisma.chatConversation.findUniqueOrThrow({ where: { id } })).userId).toBe(
        ownerId,
      );

      const asOwner = await app.inject({
        method: 'GET',
        url: `/api/chat/${id}`,
        headers: { cookie: ownerCookie },
      });
      expect(asOwner.statusCode).toBe(200);
      for (const headers of [{ cookie: otherCookie }, {}]) {
        const read = await app.inject({
          method: 'GET',
          url: `/api/chat/${id}`,
          remoteAddress: nextIp(),
          headers,
        });
        expect(read.statusCode).toBe(404);
        expect(read.json()).toMatchObject({ code: 'CHAT_NOT_FOUND' });
      }
      const write = await post(say(id, 'Hijack'), { cookie: otherCookie });
      expect(write.statusCode).toBe(404);
      expect(calls).toHaveLength(1);
    });

    it('id sai dạng hay chưa có → 404', async () => {
      for (const url of ['/api/chat/not-a-uuid', `/api/chat/${newId()}`]) {
        expect((await app.inject({ method: 'GET', url, remoteAddress: nextIp() })).statusCode).toBe(
          404,
        );
      }
    });
  });

  describe('đọc đơn của chính khách (ADR-0050 AMEND 2)', () => {
    /** Tên các tool model được thấy ở một lần gọi. */
    const toolNames = (index: number) =>
      (calls[index]?.tools ?? []).map((tool) => ('name' in tool ? tool.name : '')).sort();

    async function seedBooking(userId: string, code: string) {
      const tour = await prisma.tour.findFirstOrThrow({ where: { slug: 'hue-food-walk' } });
      const departure = await prisma.tourDeparture.findFirstOrThrow({ where: { tourId: tour.id } });
      return prisma.booking.create({
        data: {
          code,
          userId,
          tourId: tour.id,
          departureId: departure.id,
          numAdults: 2,
          totalAmount: '90.00',
          currency: 'USD',
          status: BookingStatus.PAID,
          paidAt: new Date(),
          tourTitle: tour.title,
          departureStartDate: departure.startDate,
          departureEndDate: departure.endDate,
          unitPrice: '45.00',
          contactName: 'Private Contact',
          contactEmail: `${code.toLowerCase()}@private.test`,
          contactPhone: '+84 900 111 222',
          specialRequests: 'Secret allergy note',
          paymentProvider: 'STRIPE',
        },
      });
    }

    it('hội thoại vô chủ: lượt có phiên gắn nó vào tài khoản, từ đó chỉ chủ đọc ghi được', async () => {
      const id = newId();
      script = [textReply('Hi visitor'), textReply('Hi member')];
      await post(say(id, 'Hello'));
      await waitForTurnEnd(id);
      expect((await prisma.chatConversation.findUniqueOrThrow({ where: { id } })).userId).toBe(
        null,
      );

      // GET có phiên chỉ đọc, không gắn.
      const peek = await app.inject({
        method: 'GET',
        url: `/api/chat/${id}`,
        headers: { cookie: ownerCookie },
      });
      expect(peek.statusCode).toBe(200);
      expect((await prisma.chatConversation.findUniqueOrThrow({ where: { id } })).userId).toBe(
        null,
      );

      expect((await post(say(id, 'Signed in now'), { cookie: ownerCookie })).statusCode).toBe(200);
      await waitForTurnEnd(id);
      expect((await prisma.chatConversation.findUniqueOrThrow({ where: { id } })).userId).toBe(
        ownerId,
      );
      // Lượt đầu tiên sau khi gắn đã có tool đọc đơn.
      expect(toolNames(1)).toContain('listMyBookings');

      const anonymous = await app.inject({
        method: 'GET',
        url: `/api/chat/${id}`,
        remoteAddress: nextIp(),
      });
      expect(anonymous.statusCode).toBe(404);
      expect((await post(say(id, 'Hijack'), { cookie: otherCookie })).statusCode).toBe(404);
      expect((await post(say(id, 'Anonymous again'))).statusCode).toBe(404);
      expect(calls).toHaveLength(2);
    });

    it('khách vãng lai: không có tool đọc đơn, prompt có câu mời đăng nhập', async () => {
      const id = newId();
      script = [textReply("I can't check this because you're not signed in.")];
      await post(say(id, 'Did I pay for my Hue trip?'));
      await waitForTurnEnd(id);
      expect(toolNames(0)).toEqual(['getTourDetails', 'searchTours', 'submitEnquiry']);
      const system = JSON.stringify(calls[0]?.prompt[0]);
      expect(system).toContain('The visitor is not signed in');
      expect(system).toContain('[sign in](/login)');
    });

    it('khách đã đăng nhập: chỉ thấy đơn của mình, không lộ email hay điện thoại', async () => {
      await seedTour();
      await seedBooking(ownerId, 'BK-OWNER001');
      await seedBooking(otherId, 'BK-OTHER001');
      const id = newId();
      script = [
        toolCall('listMyBookings', {}, 'call-list'),
        toolCall('getMyBooking', { code: 'BK-OTHER001' }, 'call-other'),
        toolCall('getMyBooking', { code: 'bk-owner001' }, 'call-mine'),
        textReply('Your Hue Food Walk is paid.'),
      ];
      const res = await post(say(id, 'Is my Hue trip paid?'), { cookie: ownerCookie });
      expect(res.statusCode).toBe(200);
      await waitForTurnEnd(id);

      expect(toolNames(0)).toEqual([
        'getMyBooking',
        'getTourDetails',
        'listMyBookings',
        'searchTours',
        'submitEnquiry',
      ]);
      expect(JSON.stringify(calls[0]?.prompt[0])).toContain('The visitor is signed in');

      const reply = (await rows(id))[1]?.payload as unknown as UIMessage;
      const outputs = reply.parts.filter(
        (p) => p.type === 'tool-listMyBookings' || p.type === 'tool-getMyBooking',
      ) as Array<{ type: string; state: string; output: Record<string, unknown> }>;
      expect(outputs.map((p) => p.state)).toEqual([
        'output-available',
        'output-available',
        'output-available',
      ]);
      expect(outputs[0]?.output).toMatchObject({
        total: 1,
        bookings: [
          expect.objectContaining({
            code: 'BK-OWNER001',
            url: '/account/bookings/BK-OWNER001',
            status: 'Confirmed, trip upcoming',
            payment: 'Paid',
          }),
        ],
      });
      expect(outputs[1]?.output).toEqual({ found: false });
      expect(outputs[2]?.output).toMatchObject({
        found: true,
        code: 'BK-OWNER001',
        paymentMethod: 'Card',
        refunded: '0.00',
      });

      const stored = JSON.stringify(reply);
      for (const secret of ['@private.test', '+84 900', 'Private Contact', 'Secret allergy']) {
        expect(stored).not.toContain(secret);
      }
    });
  });

  it('tool đọc chạy trên tour thật: searchTours rồi getTourDetails rồi trả lời', async () => {
    await seedTour();
    const id = newId();
    script = [
      toolCall('searchTours', { destination: 'hue' }, 'call-search'),
      toolCall('getTourDetails', { slug: 'hue-food-walk' }, 'call-detail'),
      textReply('The Hue Food Walk is $45.'),
    ];
    const res = await post(say(id, 'Food tours in Hue?', { tourSlug: 'hue-food-walk' }));
    expect(res.statusCode).toBe(200);
    await waitForTurnEnd(id);

    // Prompt có slug điểm đến đang có tour và tour đang xem.
    const system = calls[0]?.prompt[0];
    expect(JSON.stringify(system)).toContain('hue (Hue)');
    expect(JSON.stringify(system)).toContain('hue-food-walk');

    const reply = (await rows(id))[1]?.payload as unknown as UIMessage;
    const search = reply.parts.find((p) => p.type === 'tool-searchTours');
    expect(search).toMatchObject({
      state: 'output-available',
      output: { total: 1, tours: [expect.objectContaining({ url: '/tours/hue-food-walk' })] },
    });
    const detail = reply.parts.find((p) => p.type === 'tool-getTourDetails');
    expect(detail).toMatchObject({
      state: 'output-available',
      output: {
        found: true,
        bookUrl: '/tours/hue-food-walk/book',
        departures: [expect.objectContaining({ price: '45.00', seatsLeft: 7 })],
      },
    });
    // Ba lượt gọi model, token cộng dồn vào MỘT tin trả lời.
    expect(calls).toHaveLength(3);
    expect((await rows(id))[1]).toMatchObject({ inputTokens: 2600, outputTokens: 130 });
  });

  // Thử production 19/10 (A8): dòng log mỗi lượt không nói khách đang ở trang tour nào nên
  // không soi được model đã nhận slug chưa. Slug là dữ liệu công khai, không phải PII.
  it('dòng log mỗi lượt ghi tour của trang đang xem, không ghi nội dung tin', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log');
    try {
      const id = newId();
      script = [textReply('Hi!')];
      const res = await post(
        say(id, 'Seats on the next departure?', { tourSlug: 'hue-food-walk' }),
      );
      expect(res.statusCode).toBe(200);
      await waitForTurnEnd(id);

      const turnLine = await vi.waitFor(() => {
        const line = logSpy.mock.calls
          .map(([message]) => String(message))
          .find((message) => message.startsWith('chat turn') && message.includes(id));
        if (line === undefined) throw new Error('chưa có dòng log của lượt');
        return line;
      });
      expect(JSON.parse(turnLine.slice('chat turn '.length))).toMatchObject({
        conversationId: id,
        page: 'hue-food-walk',
        tools: [],
      });
      expect(turnLine).not.toContain('Seats on the next departure');
    } finally {
      logSpy.mockRestore();
    }
  });

  describe('submitEnquiry cần khách bấm Send', () => {
    const enquiry = {
      name: 'An Nguyen',
      email: 'an@example.com',
      message: 'Is there space for two on the March walk?',
    };

    async function propose(id: string) {
      // Model điền slug tour đang xem như prompt dặn.
      script = [
        toolCall('submitEnquiry', { ...enquiry, tourSlug: 'hue-food-walk' }, 'call-enquiry'),
      ];
      const res = await post(say(id, 'Please send my enquiry', { tourSlug: 'hue-food-walk' }));
      expect(res.statusCode).toBe(200);
      await waitForTurnEnd(id);
      const reply = (await rows(id))[1]?.payload as unknown as UIMessage;
      const part = reply.parts.find((p) => p.type === 'tool-submitEnquiry') as
        | {
            state: string;
            input: Record<string, unknown>;
            approval: { id: string; requestReason?: string };
          }
        | undefined;
      if (!part) throw new Error('no submitEnquiry part');
      return part;
    }

    it('chưa bấm → 0 enquiry, thẻ chờ mang slug và tên tour', async () => {
      await seedTour();
      const id = newId();
      const part = await propose(id);
      expect(part.state).toBe('approval-requested');
      expect(part.input.tourSlug).toBe('hue-food-walk');
      expect(part.approval.requestReason).toBe('Hue Food Walk');
      expect(await prisma.enquiry.count()).toBe(0);
    });

    it('Send → đúng một enquiry gắn tour, hai outbox, enquiry_id; gửi lại quyết định cũ → 400', async () => {
      const tour = await seedTour();
      const id = newId();
      const part = await propose(id);

      script = [textReply('Sent! The team will reply by email.')];
      const res = await post(decide(id, part.approval.id, true));
      expect(res.statusCode).toBe(200);
      await waitForTurnEnd(id);

      const enquiries = await prisma.enquiry.findMany();
      expect(enquiries).toHaveLength(1);
      expect(enquiries[0]).toMatchObject({ email: enquiry.email, tourId: tour.id, userId: null });
      expect((await prisma.outbox.findMany()).map((o) => o.type).sort()).toEqual(
        [EmailType.ENQUIRY_ADMIN_ALERT, EmailType.ENQUIRY_RECEIVED].sort(),
      );
      expect((await prisma.chatConversation.findUniqueOrThrow({ where: { id } })).enquiryId).toBe(
        enquiries[0]?.id,
      );

      // Lượt duyệt nối tiếp CHÍNH tin trả lời (cùng seq), token cộng dồn.
      const saved = await rows(id);
      expect(saved).toHaveLength(2);
      expect(saved[1]).toMatchObject({ inputTokens: 1800, outputTokens: 90 });
      const reply = saved[1]?.payload as unknown as UIMessage;
      expect(reply.parts.find((p) => p.type === 'tool-submitEnquiry')).toMatchObject({
        state: 'output-available',
        output: { sent: true },
      });

      const again = await post(decide(id, part.approval.id, true));
      expect(again.statusCode).toBe(400);
      expect(again.json()).toMatchObject({ code: 'INVALID_INPUT' });
      expect(await prisma.enquiry.count()).toBe(1);
    });

    it('Cancel → 0 enquiry, model nhận lời từ chối', async () => {
      await seedTour();
      const id = newId();
      const part = await propose(id);
      script = [textReply('No problem, nothing was sent.')];
      expect((await post(decide(id, part.approval.id, false))).statusCode).toBe(200);
      await waitForTurnEnd(id);
      expect(await prisma.enquiry.count()).toBe(0);
      const reply = (await rows(id))[1]?.payload as unknown as UIMessage;
      expect(reply.parts.find((p) => p.type === 'tool-submitEnquiry')).toMatchObject({
        state: 'output-denied',
      });
      // Model đọc được vì sao chưa gửi, thay cho câu lỗi mặc định "Tool call execution
      // denied." của SDK (B3 thử 19/10: model nói "unable to process").
      expect(JSON.stringify(calls.at(-1)?.prompt)).toContain(ENQUIRY_CANCELLED_REASON);
      expect(JSON.stringify(calls.at(-1)?.prompt)).not.toContain('Tool call execution denied');
    });

    it('gõ tin mới thay vì bấm thẻ → thẻ tự bị từ chối, không enquiry nào', async () => {
      await seedTour();
      const id = newId();
      await propose(id);
      script = [textReply('Sure, what else?')];
      const res = await post(say(id, 'Actually, one more question'));
      expect(res.statusCode).toBe(200);
      await waitForTurnEnd(id);
      expect(await prisma.enquiry.count()).toBe(0);
      const saved = await rows(id);
      expect(saved).toHaveLength(4);
      const old = saved[1]?.payload as unknown as UIMessage;
      expect(old.parts.find((p) => p.type === 'tool-submitEnquiry')).toMatchObject({
        state: 'output-denied',
      });
      expect(JSON.stringify(calls.at(-1)?.prompt)).toContain(ENQUIRY_SKIPPED_REASON);
    });

    it('lần thứ hai trong cùng hội thoại → already_sent, không thêm enquiry', async () => {
      await seedTour();
      const id = newId();
      const first = await propose(id);
      script = [textReply('Sent!')];
      await post(decide(id, first.approval.id, true));
      await waitForTurnEnd(id);

      script = [toolCall('submitEnquiry', enquiry, 'call-enquiry-2')];
      await post(say(id, 'Send another one'));
      await waitForTurnEnd(id);
      const pendingReply = (await rows(id))[3]?.payload as unknown as UIMessage | undefined;
      const second = pendingReply?.parts.find((p) => p.type === 'tool-submitEnquiry') as
        | { approval: { id: string } }
        | undefined;
      if (!second) throw new Error('no second submitEnquiry part');
      script = [textReply('Already sent earlier.')];
      await post(decide(id, second.approval.id, true));
      await waitForTurnEnd(id);

      expect(await prisma.enquiry.count()).toBe(1);
      const reply = (await rows(id))[3]?.payload as unknown as UIMessage;
      expect(reply.parts.find((p) => p.type === 'tool-submitEnquiry')).toMatchObject({
        output: { sent: false, reason: 'already_sent' },
      });
    });
  });

  it('khách đóng kết nối giữa stream → lượt vẫn chạy trọn và được ghi kèm token', async () => {
    const id = newId();
    chunkDelayInMs = 40;
    script = [textReply('A long answer', usage(900, 70), 8)];
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: address.port,
          method: 'POST',
          path: '/api/chat',
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          res.once('data', () => {
            // Nhận được mẩu đầu tiên rồi bỏ đi như khách đóng tab.
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err);
      });
      req.end(JSON.stringify(say(id, 'Tell me everything')));
    });

    await waitForTurnEnd(id);
    const saved = await rows(id);
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ inputTokens: 900, outputTokens: 70 });
    const reply = saved[1]?.payload as unknown as UIMessage;
    expect(JSON.stringify(reply.parts)).toContain(' 7');
  });

  describe('CORS trên stream (canh lỗi chép header sang reply.raw)', () => {
    const origin = corsOrigins[0] ?? 'http://localhost:3000';

    it('preflight OPTIONS /api/chat từ origin web được phép', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/chat',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.statusCode).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    });

    it('response stream mang header CORS và helmet', async () => {
      const id = newId();
      script = [textReply('Hi')];
      const res = await post(say(id, 'Hi'), { origin });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      await waitForTurnEnd(id);
    });
  });
});
