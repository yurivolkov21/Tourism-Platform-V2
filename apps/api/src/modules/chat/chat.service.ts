import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ChatErrorCode, ChatRequest, ChatStatus } from '@tourism/contract';
import { CHAT_LIMITS } from '@tourism/contract';
import {
  convertToModelMessages,
  isStepCount,
  isToolUIPart,
  type LanguageModel,
  type LanguageModelUsage,
  readUIMessageStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
  validateUIMessages,
} from 'ai';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ChatRole } from '../../generated/prisma/enums.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { EnquiriesService } from '../enquiries/enquiries.service.js';
import { isOverDailyBudget, utcDayStart } from './chat-budget.js';
import { CHAT_CONFIG, CHAT_LANGUAGE_MODEL, type ChatConfig } from './chat-config.js';
import {
  countUserMessages,
  type PreparedTurn,
  prepareTurn,
  type StoredChatRow,
  settleApproval,
} from './chat-history.js';
import { buildInstructions, type PromptOption } from './chat-prompt.js';
import { peekUntilContent } from './chat-stream.js';
import { createChatTools } from './chat-tools.js';

/** Một lượt giữ hội thoại lâu nhất bao lâu trước khi bị coi là chết (khớp `connectionTimeout` 120 giây). */
const TURN_HOLD_MS = 120_000;
/** Danh sách slug trong prompt đổi hiếm, đọc lại sau 5 phút (plan, chốt thêm). */
const PROMPT_OPTIONS_TTL_MS = 5 * 60_000;
/** Trần mỗi lượt (spec §2e). */
const MAX_STEPS = 5;
const MAX_OUTPUT_TOKENS = 800;

function chatError(status: HttpStatus, code: ChatErrorCode, message: string): HttpException {
  // Thân `{ code, message }` → AllExceptionsFilter dựng envelope `{ defined, code, … }`.
  return new HttpException({ code, message }, status);
}

const unavailable = () =>
  chatError(HttpStatus.SERVICE_UNAVAILABLE, 'CHAT_UNAVAILABLE', 'Chat is unavailable');

/**
 * Trợ lý AI tư vấn tour (ADR-0050, spec §2a). Lịch sử sống ở server; mỗi lượt chỉ
 * nhận một tin mới hoặc một quyết định duyệt.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private promptOptions:
    | { at: number; destinations: PromptOption[]; categories: PromptOption[] }
    | undefined;

  constructor(
    @Inject(CHAT_CONFIG) private readonly config: ChatConfig,
    @Inject(CHAT_LANGUAGE_MODEL) private readonly model: LanguageModel | null,
    private readonly catalog: CatalogService,
    private readonly enquiries: EnquiriesService,
    private readonly bookings: BookingsService,
  ) {}

  /** `GET /api/chat`: cờ bật và hôm nay chưa chạm trần. Lượt gọi này cũng đánh thức API. */
  async status(now = new Date()): Promise<ChatStatus> {
    return { available: this.isEnabled() && !(await this.overBudget(now)) };
  }

  /** `GET /api/chat/:id`: tin để hiển thị lại; không thấy hoặc không phải của phiên này → null. */
  async getConversation(id: string, userId: string | null): Promise<UIMessage[] | null> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!conversation || !this.canAccess(conversation.userId, userId)) return null;
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { seq: 'asc' },
      select: { payload: true },
    });
    return rows.map((row) => row.payload as unknown as UIMessage);
  }

  /**
   * `POST /api/chat`: kiểm theo thứ tự spec §2a bước 3, giữ lượt, rồi trả stream UI
   * message đã đọc trước tới nội dung đầu tiên. Mọi lỗi trước stream là HttpException
   * (filter dựng envelope); lỗi giữa stream đi thành chunk lỗi.
   */
  async startTurn(
    request: ChatRequest,
    userId: string | null,
    now = new Date(),
  ): Promise<ReadableStream<UIMessageChunk>> {
    const model = this.model;
    if (model === null || !this.isEnabled()) throw unavailable();
    if (await this.overBudget(now)) throw unavailable();

    const conversationId = request.conversationId;
    await this.claimConversation(conversationId, request.input.type, userId);
    await this.holdTurn(conversationId, now);

    // Từ đây đã giữ lượt: nhánh nào thoát trước khi stream chạy thì phải nhả.
    let handedOff = false;
    try {
      const rows = await this.loadRows(conversationId);
      if (
        request.input.type === 'message' &&
        countUserMessages(rows) >= CHAT_LIMITS.userMessagesPerConversation
      ) {
        throw chatError(HttpStatus.CONFLICT, 'CHAT_TURN_LIMIT', 'Conversation limit reached');
      }
      const turn = prepareTurn(rows, request.input, randomUUID());
      if (!turn.ok) {
        throw chatError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Approval is no longer pending');
      }

      const stream = await this.runTurn(model, turn, request, userId);
      handedOff = true;
      return stream;
    } finally {
      if (!handedOff) await this.releaseTurn(conversationId);
    }
  }

  // ── Các bước của một lượt ────────────────────────────────────────────────

  private isEnabled(): boolean {
    return this.config.enabled && this.model !== null;
  }

  private canAccess(ownerId: string | null, userId: string | null): boolean {
    // Hội thoại gắn tài khoản chỉ chủ đọc được; hội thoại khách vãng lai thì ai biết
    // id là đọc được (rủi ro đã chấp nhận, schema.prisma).
    return ownerId === null || ownerId === userId;
  }

  private async overBudget(now: Date): Promise<boolean> {
    const spent = await prisma.chatMessage.aggregate({
      where: { createdAt: { gte: utcDayStart(now) } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return isOverDailyBudget(
      {
        inputTokens: spent._sum.inputTokens ?? 0,
        outputTokens: spent._sum.outputTokens ?? 0,
      },
      this.config.model,
      this.config.budgetUsd,
    );
  }

  /**
   * Tạo hội thoại ở tin đầu, gắn tài khoản nếu có phiên. Id đã gắn tài khoản khác → 404
   * (không lộ là id có tồn tại). Quyết định duyệt cho id chưa có thì không tạo gì.
   *
   * Hội thoại đã có mà chưa có chủ, lượt này lại có phiên: gắn vào tài khoản TRƯỚC khi chạy
   * lượt (ADR-0050 AMEND 2 mục 3). Hội thoại vô chủ thì ai biết id cũng đọc được, nên dữ liệu
   * đơn chỉ được vào hội thoại đã thuộc đúng người có đơn.
   */
  private async claimConversation(
    id: string,
    inputType: ChatRequest['input']['type'],
    userId: string | null,
  ): Promise<void> {
    const existing = await prisma.chatConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (existing) {
      if (!this.canAccess(existing.userId, userId)) {
        throw chatError(HttpStatus.NOT_FOUND, 'CHAT_NOT_FOUND', 'Conversation not found');
      }
      if (existing.userId === null && userId !== null) await this.bindToAccount(id, userId);
      return;
    }
    if (inputType === 'approval') {
      throw chatError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Approval is no longer pending');
    }
    // Hai tin đầu cùng id đến song song: một bên tạo, bên kia bỏ qua rồi đi tiếp
    // tới cột giữ lượt — nơi phân xử thật.
    await prisma.chatConversation.createMany({ data: [{ id, userId }], skipDuplicates: true });
    const created = await prisma.chatConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!created || !this.canAccess(created.userId, userId)) {
      throw chatError(HttpStatus.NOT_FOUND, 'CHAT_NOT_FOUND', 'Conversation not found');
    }
  }

  /**
   * Gắn hội thoại vô chủ vào tài khoản. Điều kiện `userId: null` nằm trong câu UPDATE: hai
   * phiên khác nhau cùng gửi vào một id thì chỉ một bên gắn được, bên kia đọc lại thấy chủ
   * khác và nhận 404 như mọi hội thoại không phải của mình.
   */
  private async bindToAccount(id: string, userId: string): Promise<void> {
    await prisma.chatConversation.updateMany({ where: { id, userId: null }, data: { userId } });
    const bound = await prisma.chatConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (bound?.userId !== userId) {
      throw chatError(HttpStatus.NOT_FOUND, 'CHAT_NOT_FOUND', 'Conversation not found');
    }
  }

  /** Cột giữ lượt (ADR-0050 AMEND 1): một câu UPDATE có điều kiện; 0 dòng là đang bận. */
  private async holdTurn(id: string, now: Date): Promise<void> {
    const { count } = await prisma.chatConversation.updateMany({
      where: {
        id,
        OR: [
          { turnStartedAt: null },
          { turnStartedAt: { lt: new Date(now.getTime() - TURN_HOLD_MS) } },
        ],
      },
      data: { turnStartedAt: now },
    });
    if (count === 0) {
      throw chatError(HttpStatus.CONFLICT, 'CHAT_BUSY', 'Previous reply is still running');
    }
  }

  private async releaseTurn(id: string): Promise<void> {
    try {
      await prisma.chatConversation.update({ where: { id }, data: { turnStartedAt: null } });
    } catch (err) {
      // Nhả hỏng thì hạn 2 phút tự mở lại; không để lỗi này che lỗi gốc.
      this.logger.warn(`chat: could not release turn ${id} — ${String(err)}`);
    }
  }

  private async loadRows(conversationId: string): Promise<StoredChatRow[]> {
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { seq: 'asc' },
      select: { seq: true, role: true, payload: true },
    });
    return rows.map((row) => ({
      seq: row.seq,
      role: row.role,
      message: row.payload as unknown as UIMessage,
    }));
  }

  private async loadPromptOptions(now: number) {
    if (this.promptOptions && now - this.promptOptions.at < PROMPT_OPTIONS_TTL_MS) {
      return this.promptOptions;
    }
    const [destinations, categories] = await Promise.all([
      this.catalog.listDestinations(),
      this.catalog.listCategories(),
    ]);
    // Chỉ chỗ có tour đang bán: model khỏi tìm vào chỗ trống, prompt ngắn hơn.
    this.promptOptions = {
      at: now,
      destinations: destinations
        .filter((destination) => destination.tourCount > 0)
        .map(({ slug, name }) => ({ slug, name })),
      categories: categories
        .filter((category) => category.toursCount > 0)
        .map(({ slug, name }) => ({ slug, name })),
    };
    return this.promptOptions;
  }

  /**
   * Gọi model và trả nhánh stream cho khách. Luồng UI message được tee: nhánh của khách
   * có thể bị huỷ khi khách đóng tab, nhánh của server luôn đọc tới cuối rồi mới ghi —
   * nên lượt dở vẫn chạy trọn và token đã tốn vẫn vào trần ngày (spec §4).
   */
  private async runTurn(
    model: LanguageModel,
    turn: Extract<PreparedTurn, { ok: true }>,
    request: ChatRequest,
    userId: string | null,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const conversationId = request.conversationId;
    const startedAt = Date.now();
    const options = await this.loadPromptOptions(startedAt);
    const { tools, toolApproval } = createChatTools({
      catalog: this.catalog,
      enquiries: this.enquiries,
      bookings: this.bookings,
      findPublishedTour: (slug) =>
        prisma.tour.findFirst({
          where: { slug, isPublished: true },
          select: { id: true, title: true },
        }),
      hasEnquiry: async () =>
        (
          await prisma.chatConversation.findUnique({
            where: { id: conversationId },
            select: { enquiryId: true },
          })
        )?.enquiryId != null,
      linkEnquiry: async (enquiryId) => {
        await prisma.chatConversation.updateMany({
          where: { id: conversationId, enquiryId: null },
          data: { enquiryId },
        });
      },
      userId,
    });

    const messages = await validateUIMessages({ messages: turn.messages, tools });
    const result = streamText({
      model,
      instructions: buildInstructions({
        now: new Date(startedAt),
        destinations: options.destinations,
        categories: options.categories,
        signedIn: userId !== null,
        ...(request.tourSlug === undefined ? {} : { tourSlug: request.tourSlug }),
      }),
      messages: await convertToModelMessages(messages, { tools }),
      tools,
      toolApproval,
      stopWhen: isStepCount(MAX_STEPS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // Mỗi lần tối đa một lời gọi tool: thẻ xác nhận không bao giờ phải chờ hai cái.
      providerOptions: { anthropic: { disableParallelToolUse: true } },
    });

    const uiStream = toUIMessageStream({
      stream: result.stream,
      tools,
      sendReasoning: false,
      originalMessages: messages,
      generateMessageId: randomUUID,
      onError: (error) => {
        this.logger.warn(`chat: stream error in ${conversationId} — ${String(error)}`);
        return 'Something went wrong.';
      },
    });
    const [clientBranch, serverBranch] = uiStream.tee();

    const pending = turn.kind === 'approval' ? messages.at(-1) : undefined;
    // Gắn sẵn nhánh từ chối: lượt hỏng có thể làm promise token bị reject mà nhánh lỗi
    // của `finishTurn` không đợi nó — để trần thì thành unhandled rejection.
    const usage = Promise.resolve(result.totalUsage).then(
      (value): LanguageModelUsage | null => value,
      () => null,
    );
    const finished = this.finishTurn({
      conversationId,
      turn,
      serverBranch,
      ...(pending ? { pending } : {}),
      usage,
      startedAt,
      ...(request.tourSlug === undefined ? {} : { tourSlug: request.tourSlug }),
    });

    const peeked = await peekUntilContent(clientBranch);
    if (!peeked.ok) {
      // Lỗi trước nội dung: chờ nhánh server khép lượt (không ghi gì, nhả cột giữ
      // lượt) để khách bấm Retry ngay không dính CHAT_BUSY.
      await finished;
      throw unavailable();
    }
    return peeked.stream;
  }

  /** Nhánh server: đọc trọn lượt, rồi ghi một lần (plan, quyết định 3 và 4). */
  private async finishTurn(input: {
    conversationId: string;
    turn: Extract<PreparedTurn, { ok: true }>;
    serverBranch: ReadableStream<UIMessageChunk>;
    pending?: UIMessage;
    usage: Promise<LanguageModelUsage | null>;
    startedAt: number;
    /** Slug trang tour khách đang xem — chỉ để ghi log, là dữ liệu công khai. */
    tourSlug?: string;
  }): Promise<void> {
    const { conversationId, turn } = input;
    let failed = false;
    let response: UIMessage | undefined;
    try {
      for await (const message of readUIMessageStream({
        stream: input.serverBranch,
        // SDK sửa tại chỗ tin được đưa vào (useChat tự chụp bản sao trước khi đưa), nên đưa
        // bản sao: `settleApproval` cần tin đang chờ đúng như lúc trước lượt.
        ...(input.pending ? { message: structuredClone(input.pending) } : {}),
        onError: () => {
          failed = true;
        },
      })) {
        response = message;
      }
      if (failed || response === undefined) {
        // Lượt duyệt mà tool đã chạy xong trước khi model lỗi: enquiry đã gửi nên thẻ phải
        // được ghi ở trạng thái cuối, không thì lượt sau tự từ chối nó (L7-01, review 20/10).
        const settled = input.pending && response ? settleApproval(input.pending, response) : null;
        if (settled === null) {
          // Lỗi giữa stream: không ghi gì, khách bấm Retry gửi lại đúng tin cũ.
          await this.releaseTurn(conversationId);
          return;
        }
        response = settled;
      }
      const usage = await input.usage;
      if (usage === null) this.logger.warn(`chat: no token usage for ${conversationId}`);
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      await this.persist(conversationId, turn, response, inputTokens, outputTokens);
      // Một dòng log mỗi lượt, KHÔNG có nội dung tin (spec §4: tin khách là PII).
      this.logger.log(
        `chat turn ${JSON.stringify({
          conversationId,
          inputTokens,
          outputTokens,
          ms: Date.now() - input.startedAt,
          // Trang tour lúc gửi tin, để soi model có bám đúng tour đang xem không (A8, 19/10).
          page: input.tourSlug ?? null,
          tools: response.parts.filter(isToolUIPart).map((part) => part.type.slice(5)),
        })}`,
      );
    } catch (err) {
      this.logger.error(`chat: could not finish turn ${conversationId} — ${String(err)}`);
      await this.releaseTurn(conversationId);
    }
  }

  /** Ghi tin của lượt và nhả cột giữ lượt trong cùng một transaction. */
  private async persist(
    conversationId: string,
    turn: Extract<PreparedTurn, { ok: true }>,
    response: UIMessage,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    const json = (message: UIMessage) => message as unknown as Prisma.InputJsonValue;
    await prisma.$transaction(async (tx) => {
      if (turn.kind === 'message') {
        if (turn.rewritten) {
          await tx.chatMessage.update({
            where: { conversationId_seq: { conversationId, seq: turn.rewritten.seq } },
            data: { payload: json(turn.rewritten.message) },
          });
        }
        await tx.chatMessage.createMany({
          data: [
            {
              conversationId,
              seq: turn.userSeq,
              role: ChatRole.USER,
              payload: json(turn.userMessage),
            },
            {
              conversationId,
              seq: turn.userSeq + 1,
              role: ChatRole.ASSISTANT,
              payload: json(response),
              inputTokens,
              outputTokens,
            },
          ],
        });
      } else {
        // Lượt duyệt nối tiếp chính tin trả lời đang chờ: ghi đè tin đó và CỘNG token
        // của lượt vào nó (plan, quyết định 3).
        const where = { conversationId_seq: { conversationId, seq: turn.pendingSeq } };
        const current = await tx.chatMessage.findUniqueOrThrow({
          where,
          select: { inputTokens: true, outputTokens: true },
        });
        await tx.chatMessage.update({
          where,
          data: {
            payload: json(response),
            inputTokens: (current.inputTokens ?? 0) + inputTokens,
            outputTokens: (current.outputTokens ?? 0) + outputTokens,
          },
        });
      }
      // Chạm `updated_at` (mốc của job dọn) và nhả lượt.
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { turnStartedAt: null },
      });
    });
  }
}
