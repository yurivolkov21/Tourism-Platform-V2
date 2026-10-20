import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_STORAGE_KEY } from '@/lib/concierge';
import { ChatMarkdown } from './chat-markdown';
import { ContactLauncher } from './contact-launcher';

/**
 * Nút "Plan your trip" và khung chat (P6, spec §5 phần web) chạy với `fetch` giả: API trả
 * status, lịch sử, hoặc stream UI message dựng tay — không có API thật hay model nào.
 */

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

/** Phiên Better Auth giả: test đổi giá trị rồi `rerender` để giả đăng nhập, đăng xuất. */
const auth = vi.hoisted(() => ({
  session: null as { user: { id: string; name: string } } | null,
  isPending: false,
}));
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: auth.session, isPending: auth.isPending }),
}));

const t = messages.chatBot;
const API = 'http://localhost:3001/api/chat';
const STORED_ID = '0b6f6d2e-5a8b-4c41-9a6e-2f1d3c4b5a69';

type Chunk = Record<string, unknown>;

/** Một lượt trả lời: SSE của giao thức UI message, như `writeUIMessageStream` phía API. */
function sse(chunks: Chunk[]): Response {
  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  });
}

/** Stream mà test tự đẩy chunk và tự đóng — để bắt trạng thái giữa lượt. */
function openStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    }),
    push: (chunk: Chunk) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)),
    close: () => {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  };
}

const textReply = (messageId: string, text: string): Chunk[] => [
  { type: 'start', messageId },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface FakeApi {
  available: boolean;
  /** Có thì `GET /api/chat` chờ promise này — giả API gói free đang dậy. */
  statusGate: Promise<void> | null;
  history: Response | null;
  turns: Array<Response | (() => Response)>;
  posts: Array<Record<string, unknown>>;
}

let api: FakeApi;

beforeEach(() => {
  navigation.pathname = '/';
  window.localStorage.clear();
  auth.session = null;
  auth.isPending = false;
  api = { available: true, statusGate: null, history: null, turns: [], posts: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        api.posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        const next = api.turns.shift();
        if (next === undefined) throw new Error('no scripted turn');
        return typeof next === 'function' ? next() : next;
      }
      if (url === API) {
        if (api.statusGate) await api.statusGate;
        return json(200, { available: api.available });
      }
      if (url.startsWith(`${API}/`)) return api.history ?? json(404, { code: 'CHAT_NOT_FOUND' });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openChat(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: messages.contactLauncher.triggerAria }));
  return user;
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: t.inputLabel }), text);
  await user.click(screen.getByRole('button', { name: t.sendAria }));
}

describe('ContactLauncher — nút mở thẳng khung chat (ADR-0050 AMEND 2)', () => {
  it('bấm nút là mở khung chat, không còn menu hai lối; khung hỏi API trạng thái', async () => {
    render(<ContactLauncher />);
    await openChat();

    expect(screen.getByRole('dialog', { name: t.title })).toBeVisible();
    expect(screen.queryByText('Talk to us')).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(API));
    expect(screen.getByRole('textbox', { name: t.inputLabel })).toBeEnabled();
  });

  it('bấm nút lần nữa thì đóng khung', async () => {
    render(<ContactLauncher />);
    const user = await openChat();
    await user.click(screen.getByRole('button', { name: messages.contactLauncher.triggerAria }));
    expect(screen.queryByRole('dialog', { name: t.title })).toBeNull();
  });

  it('API đang dậy → đầu khung báo đang kết nối, trả lời xong thì về dòng phụ thường', async () => {
    let wake!: () => void;
    api.statusGate = new Promise<void>((resolve) => {
      wake = resolve;
    });
    render(<ContactLauncher />);
    await openChat();

    expect(await screen.findByText(t.connecting)).toBeInTheDocument();
    wake();
    expect(await screen.findByText(t.subtitle)).toBeInTheDocument();
    expect(screen.queryByText(t.connecting)).toBeNull();
  });

  it('trợ lý nghỉ → câu "taking a break" kèm link enquiry của tour đang xem, ô gõ khoá', async () => {
    api.available = false;
    navigation.pathname = '/tours/ha-long-2d1n';
    render(<ContactLauncher />);
    await openChat();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.unavailable);
    expect(within(alert).getByRole('link', { name: t.enquiryLink })).toHaveAttribute(
      'href',
      '/tours/ha-long-2d1n/enquire',
    );
    expect(screen.getByRole('textbox', { name: t.inputLabel })).toBeDisabled();
    expect(screen.queryByRole('button', { name: t.suggestions.findTour })).toBeNull();
  });
});

describe('ContactLauncher — tài khoản', () => {
  it('vãng lai: lời chào chung, không có gợi ý xem đơn', async () => {
    render(<ContactLauncher />);
    await openChat();

    expect(await screen.findByText(t.greeting)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.suggestions.myBookings })).toBeNull();
  });

  it('đã đăng nhập: chào theo tên, gợi ý "Show my bookings" gửi đúng câu ấy', async () => {
    auth.session = { user: { id: 'user-a', name: 'An Nguyen' } };
    api.turns.push(sse(textReply('a1', 'You have one upcoming trip.')));
    render(<ContactLauncher />);
    const user = await openChat();

    expect(await screen.findByText(t.greetingFor('An Nguyen'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.suggestions.myBookings }));
    expect(await screen.findByText('You have one upcoming trip.')).toBeInTheDocument();
    expect(api.posts[0]?.input).toEqual({ type: 'message', text: t.suggestions.myBookings });
  });

  it('đăng xuất: xoá id hội thoại khỏi trình duyệt và dỡ khung, mở lại là hội thoại mới', async () => {
    auth.session = { user: { id: 'user-a', name: 'An Nguyen' } };
    api.turns.push(sse(textReply('a1', 'Your booking BK-AB12CD34 is paid.')));
    const { rerender } = render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Is my trip paid?');
    expect(await screen.findByText('Your booking BK-AB12CD34 is paid.')).toBeInTheDocument();
    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).not.toBeNull();

    auth.session = null;
    rerender(<ContactLauncher />);

    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('dialog', { name: t.title })).toBeNull();
    await openChat(user);
    expect(await screen.findByText(t.greeting)).toBeInTheDocument();
    expect(screen.queryByText('Your booking BK-AB12CD34 is paid.')).toBeNull();
  });

  it('phiên còn đang đọc (lúc hydrate) không bị coi là đăng xuất', async () => {
    auth.session = { user: { id: 'user-a', name: 'An Nguyen' } };
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, STORED_ID);
    const { rerender } = render(<ContactLauncher />);
    auth.session = null;
    auth.isPending = true;
    rerender(<ContactLauncher />);
    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe(STORED_ID);
  });

  it('đăng nhập từ vãng lai: giữ hội thoại đang mở', async () => {
    api.turns.push(sse(textReply('a1', 'Hue is lovely in spring.')));
    const { rerender } = render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'When to visit Hue?');
    expect(await screen.findByText('Hue is lovely in spring.')).toBeInTheDocument();
    const stored = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);

    auth.session = { user: { id: 'user-a', name: 'An Nguyen' } };
    rerender(<ContactLauncher />);

    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe(stored);
    expect(screen.getByText('Hue is lovely in spring.')).toBeInTheDocument();
  });
});

describe('ChatPanel — một lượt', () => {
  it('gửi đúng một tin và slug tour; hiện câu trả lời; giữ id; báo một lần khi xong', async () => {
    navigation.pathname = '/tours/ha-long-2d1n/book';
    api.turns.push(sse(textReply('a1', 'The **Ha Long** cruise has space.')));
    render(<ContactLauncher />);
    const user = await openChat();

    expect(screen.getByRole('dialog', { name: t.title })).toBeInTheDocument();
    await say(user, 'Any space in November?');

    expect(await screen.findByText('Ha Long')).toBeInTheDocument();
    expect(screen.getByText('Any space in November?')).toBeInTheDocument();
    expect(api.posts).toHaveLength(1);
    const [body] = api.posts;
    expect(body).toMatchObject({
      tourSlug: 'ha-long-2d1n',
      input: { type: 'message', text: 'Any space in November?' },
    });
    expect(body).not.toHaveProperty('messages');
    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe(body?.conversationId);
    expect(await screen.findByText(t.liveAnswerReady)).toBeInTheDocument();
  });

  it('tool đang chạy → dòng trạng thái của tool, xong thì mất', async () => {
    const stream = openStream();
    api.turns.push(stream.response);
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Tours in Sa Pa?');

    stream.push({ type: 'start', messageId: 'a1' });
    stream.push({ type: 'start-step' });
    stream.push({
      type: 'tool-input-available',
      toolCallId: 'c1',
      toolName: 'searchTours',
      input: {},
    });
    expect(await screen.findByText(t.toolActivity.searchTours)).toBeInTheDocument();
    // Đã có thứ để xem thì chấm "đang gõ" nhường chỗ cho dòng tool.
    expect(screen.queryByText(t.thinking)).toBeNull();

    stream.push({
      type: 'tool-output-available',
      toolCallId: 'c1',
      output: { total: 0, tours: [] },
    });
    stream.push({ type: 'finish-step' });
    for (const chunk of textReply('a1', 'No Sa Pa tours right now.').slice(1)) stream.push(chunk);
    stream.close();

    expect(await screen.findByText('No Sa Pa tours right now.')).toBeInTheDocument();
    expect(screen.queryByText(t.toolActivity.searchTours)).toBeNull();
  });
});

describe('ChatPanel — chấm "đang gõ"', () => {
  it('từ lúc gửi tới chữ đầu tiên, và cả quãng giữa tool xong với chữ của bước sau', async () => {
    const stream = openStream();
    api.turns.push(stream.response);
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Tours in Hue?');

    expect(await screen.findByText(t.thinking)).toBeInTheDocument();
    stream.push({ type: 'start', messageId: 'a1' });
    stream.push({ type: 'start-step' });
    stream.push({
      type: 'tool-input-available',
      toolCallId: 'c1',
      toolName: 'searchTours',
      input: {},
    });
    expect(await screen.findByText(t.toolActivity.searchTours)).toBeInTheDocument();
    expect(screen.queryByText(t.thinking)).toBeNull();

    // Tool xong mà model chưa viết chữ: tin trả lời chưa có gì để xem, chấm quay lại.
    stream.push({
      type: 'tool-output-available',
      toolCallId: 'c1',
      output: { total: 0, tours: [] },
    });
    stream.push({ type: 'finish-step' });
    stream.push({ type: 'start-step' });
    expect(await screen.findByText(t.thinking)).toBeInTheDocument();
    expect(screen.queryByText(t.toolActivity.searchTours)).toBeNull();

    for (const chunk of textReply('a1', 'No Hue tours right now.').slice(2)) stream.push(chunk);
    stream.close();
    expect(await screen.findByText('No Hue tours right now.')).toBeInTheDocument();
    expect(screen.queryByText(t.thinking)).toBeNull();
  });
});

describe('ChatPanel — sao chép, màn chào, cuộn', () => {
  it('lượt xong mới có nút sao chép; bấm thì chép đúng chữ và báo "Copied"', async () => {
    const stream = openStream();
    api.turns.push(stream.response);
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Hi');

    stream.push({ type: 'start', messageId: 'a1' });
    stream.push({ type: 'start-step' });
    stream.push({ type: 'text-start', id: 't1' });
    stream.push({ type: 'text-delta', id: 't1', delta: 'Hello there.' });
    expect(await screen.findByText('Hello there.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.copy })).toBeNull();

    stream.push({ type: 'text-end', id: 't1' });
    stream.push({ type: 'finish-step' });
    stream.push({ type: 'finish' });
    stream.close();
    await user.click(await screen.findByRole('button', { name: t.copy }));
    expect(await navigator.clipboard.readText()).toBe('Hello there.');
    expect(await screen.findByText(t.copied)).toBeInTheDocument();
  });

  it('màn chào có gợi ý; gửi tin đầu thì lời chào thành bong bóng, gợi ý mất', async () => {
    api.turns.push(sse(textReply('a1', 'Sure!')));
    render(<ContactLauncher />);
    const user = await openChat();
    expect(screen.getByText(t.greeting)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.suggestions.talkHuman })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.suggestions.findTour }));
    expect(await screen.findByText('Sure!')).toBeInTheDocument();
    expect(screen.getByText(t.greeting)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.suggestions.findTour })).toBeNull();
  });

  it('cuộn lên đọc lại thì chữ mới không kéo xuống; nút "cuộn xuống" đưa về cuối', async () => {
    const stream = openStream();
    api.turns.push(stream.response);
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Tell me about Hue');
    stream.push({ type: 'start', messageId: 'a1' });
    stream.push({ type: 'start-step' });
    stream.push({ type: 'text-start', id: 't1' });
    stream.push({ type: 'text-delta', id: 't1', delta: 'Hue is ' });
    expect(await screen.findByText('Hue is')).toBeInTheDocument();

    // jsdom không dựng bố cục: tự đặt số đo để khung "dài 1000px, nhìn thấy 300px".
    const viewport = document.querySelector<HTMLElement>('[data-lenis-prevent]');
    if (viewport === null) throw new Error('no scroll area');
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 300 });
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));

    const jump = await screen.findByRole('button', { name: t.scrollToLatest });
    stream.push({ type: 'text-delta', id: 't1', delta: 'the old capital.' });
    expect(await screen.findByText('Hue is the old capital.')).toBeInTheDocument();
    expect(viewport.scrollTop).toBe(100);

    await user.click(jump);
    expect(viewport.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: t.scrollToLatest })).toBeNull();
    stream.close();
  });
});

describe('ChatPanel — thẻ xác nhận enquiry', () => {
  const draft = { name: 'An Nguyen', email: 'an@example.com', message: 'Two of us in May.' };
  const approvalTurn: Chunk[] = [
    { type: 'start', messageId: 'a1' },
    { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: 'c1', toolName: 'submitEnquiry', input: draft },
    {
      type: 'tool-approval-request',
      approvalId: 'ap-1',
      toolCallId: 'c1',
      reason: 'Ha Long Bay 2D1N',
    },
    { type: 'finish-step' },
    { type: 'finish' },
  ];

  it('hiện bản nháp và tên tour; Send gửi quyết định duyệt rồi báo đã gửi', async () => {
    api.turns.push(
      sse(approvalTurn),
      sse([
        { type: 'start', messageId: 'a1' },
        { type: 'start-step' },
        { type: 'tool-output-available', toolCallId: 'c1', output: { sent: true } },
        { type: 'finish-step' },
        { type: 'finish' },
      ]),
    );
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Please send my enquiry');

    const card = await screen.findByRole('region', { name: t.confirm.title });
    expect(within(card).getByText('An Nguyen')).toBeInTheDocument();
    expect(within(card).getByText('an@example.com')).toBeInTheDocument();
    expect(within(card).getByText('Ha Long Bay 2D1N')).toBeInTheDocument();
    expect(within(card).getByText('Two of us in May.')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: t.confirm.send }));

    expect(await within(card).findByText(t.confirm.sent)).toBeInTheDocument();
    expect(api.posts[1]).toMatchObject({
      input: { type: 'approval', approvalId: 'ap-1', approved: true },
    });
  });

  it('hội thoại đã gửi enquiry rồi → thẻ nói đã gửi trước đó, không nói "not sent"', async () => {
    api.turns.push(
      sse(approvalTurn),
      sse([
        { type: 'start', messageId: 'a1' },
        { type: 'start-step' },
        {
          type: 'tool-output-available',
          toolCallId: 'c1',
          output: { sent: false, reason: 'already_sent' },
        },
        { type: 'finish-step' },
        { type: 'finish' },
      ]),
    );
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Please send my enquiry');

    const card = await screen.findByRole('region', { name: t.confirm.title });
    await user.click(within(card).getByRole('button', { name: t.confirm.send }));

    expect(await within(card).findByText(t.confirm.alreadySent)).toBeInTheDocument();
    expect(within(card).queryByText(t.confirm.cancelled)).toBeNull();
  });

  it('gõ tin mới khi thẻ còn chờ → thẻ thôi mời bấm, như API tự từ chối', async () => {
    api.turns.push(sse(approvalTurn), sse(textReply('a2', 'No problem, it is not sent.')));
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Please send my enquiry');
    const card = await screen.findByRole('region', { name: t.confirm.title });

    await say(user, 'Actually, wait');

    expect(await screen.findByText('No problem, it is not sent.')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: t.confirm.send })).toBeNull();
    expect(within(card).getByText(t.confirm.cancelled)).toBeInTheDocument();
    // Thẻ đóng vẫn ghi tour như bản API lưu (tải lại thấy y vậy).
    expect(within(card).getByText('Ha Long Bay 2D1N')).toBeInTheDocument();
    expect(api.posts[1]).toMatchObject({ input: { type: 'message', text: 'Actually, wait' } });
  });

  // L7-01 (review 20/10): API chạy tool TRƯỚC khi gọi model, nên model lỗi ở bước sau thì
  // enquiry đã gửi mà lượt vẫn báo lỗi. Bản cũ hiện Retry: bấm thì tin cũ của khách đi lại như
  // tin mới, còn gõ tin mới thì thẻ "Enquiry sent" rời màn trong khi API vẫn giữ nó.
  it('Send xong mà model lỗi ở bước sau → thẻ giữ "đã gửi", không báo lỗi, gõ tiếp như thường', async () => {
    const stream = openStream();
    api.turns.push(sse(approvalTurn), stream.response, sse(textReply('a2', 'Yes, it went.')));
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Please send my enquiry');
    const card = await screen.findByRole('region', { name: t.confirm.title });
    await user.click(within(card).getByRole('button', { name: t.confirm.send }));

    stream.push({ type: 'start', messageId: 'a1' });
    stream.push({ type: 'tool-output-available', toolCallId: 'c1', output: { sent: true } });
    stream.push({ type: 'start-step' });
    stream.push({ type: 'text-start', id: 't1' });
    stream.push({ type: 'text-delta', id: 't1', delta: 'Your enq' });
    expect(await screen.findByText('Your enq')).toBeInTheDocument();
    stream.push({ type: 'error', errorText: 'Something went wrong.' });

    // Màn khớp bản API lưu: thẻ đã gửi, không có chữ dở của bước hỏng, không có lỗi để Retry.
    await waitFor(() => expect(screen.queryByText('Your enq')).toBeNull());
    expect(within(card).getByText(t.confirm.sent)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await say(user, 'Did it go through?');

    expect(await screen.findByText('Yes, it went.')).toBeInTheDocument();
    expect(screen.getByText('Please send my enquiry')).toBeInTheDocument();
    expect(within(card).getByText(t.confirm.sent)).toBeInTheDocument();
    expect(api.posts[2]).toMatchObject({ input: { type: 'message', text: 'Did it go through?' } });
  });

  it('cắt phần dở chỉ ở tin cuối: câu trả lời của lượt duyệt trước giữ nguyên', async () => {
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, STORED_ID);
    api.history = json(200, {
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Send my enquiry' }] },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-submitEnquiry',
              toolCallId: 'c0',
              state: 'output-available',
              input: draft,
              output: { sent: true },
              approval: { id: 'ap-0', approved: true },
            },
            { type: 'step-start' },
            { type: 'text', text: 'Sent! The team will reply by email.', state: 'done' },
          ],
        },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'One more for Hue' }] },
        {
          id: 'a2',
          role: 'assistant',
          parts: [
            {
              type: 'tool-submitEnquiry',
              toolCallId: 'c1',
              state: 'approval-requested',
              input: draft,
              approval: { id: 'ap-1' },
            },
          ],
        },
      ],
    });
    api.turns.push(
      sse([
        { type: 'start', messageId: 'a2' },
        {
          type: 'tool-output-available',
          toolCallId: 'c1',
          output: { sent: false, reason: 'already_sent' },
        },
        { type: 'start-step' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'You already' },
        { type: 'error', errorText: 'Something went wrong.' },
      ]),
    );
    render(<ContactLauncher />);
    const user = await openChat();
    const cards = await screen.findAllByRole('region', { name: t.confirm.title });
    await user.click(within(cards[1] as HTMLElement).getByRole('button', { name: t.confirm.send }));

    expect(
      await within(cards[1] as HTMLElement).findByText(t.confirm.alreadySent),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('You already')).toBeNull());
    expect(screen.getByText('Sent! The team will reply by email.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ChatPanel — lỗi theo mã của API', () => {
  it.each([
    [409, { code: 'CHAT_BUSY' }, t.busy, t.retry],
    [429, { code: 'TOO_MANY_REQUESTS' }, t.rateLimited, t.retry],
    [409, { code: 'CHAT_TURN_LIMIT' }, t.turnLimit, t.startOver],
    [503, { code: 'CHAT_UNAVAILABLE' }, t.unavailable, null],
  ] as const)('%i %j → đúng câu và đúng lối ra', async (status, body, text, action) => {
    api.turns.push(json(status, body));
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Hello');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(text);
    if (action !== null) expect(within(alert).getByRole('button', { name: action })).toBeVisible();
  });

  it('Retry sau lượt chữ hỏng gửi lại đúng tin, không nhân đôi tin trên màn', async () => {
    api.turns.push(json(409, { code: 'CHAT_BUSY' }), sse(textReply('a1', 'Here you go.')));
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Hello');
    await user.click(
      within(await screen.findByRole('alert')).getByRole('button', { name: t.retry }),
    );

    expect(await screen.findByText('Here you go.')).toBeInTheDocument();
    expect(screen.getAllByText('Hello')).toHaveLength(1);
    expect(api.posts[1]).toMatchObject({ input: { type: 'message', text: 'Hello' } });
  });
  it('lỗi giữa stream → Retry bỏ phần trả lời dở và gửi lại đúng tin khách', async () => {
    api.turns.push(
      sse([
        { type: 'start', messageId: 'a1' },
        { type: 'start-step' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Half an ans' },
        { type: 'error', errorText: 'Something went wrong.' },
      ]),
      sse(textReply('a2', 'A whole answer.')),
    );
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Hello');
    await user.click(
      within(await screen.findByRole('alert')).getByRole('button', { name: t.retry }),
    );

    expect(await screen.findByText('A whole answer.')).toBeInTheDocument();
    expect(screen.queryByText('Half an ans')).toBeNull();
    expect(api.posts[1]).toMatchObject({ input: { type: 'message', text: 'Hello' } });
  });

  it('lượt duyệt hỏng → ô gõ khoá, Retry gửi lại đúng quyết định', async () => {
    api.turns.push(
      sse([
        { type: 'start', messageId: 'a1' },
        { type: 'start-step' },
        {
          type: 'tool-input-available',
          toolCallId: 'c1',
          toolName: 'submitEnquiry',
          input: { name: 'An', email: 'an@example.com', message: 'Hi there team' },
        },
        { type: 'tool-approval-request', approvalId: 'ap-1', toolCallId: 'c1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ]),
      json(409, { code: 'CHAT_BUSY' }),
      sse([
        { type: 'start', messageId: 'a1' },
        { type: 'start-step' },
        { type: 'tool-output-available', toolCallId: 'c1', output: { sent: true } },
        { type: 'finish-step' },
        { type: 'finish' },
      ]),
    );
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'Send it');
    const card = await screen.findByRole('region', { name: t.confirm.title });
    await user.click(within(card).getByRole('button', { name: t.confirm.send }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.busy);
    expect(screen.getByRole('textbox', { name: t.inputLabel })).toBeDisabled();

    await user.click(within(alert).getByRole('button', { name: t.retry }));

    expect(await within(card).findByText(t.confirm.sent)).toBeInTheDocument();
    for (const post of api.posts.slice(1)) {
      expect(post).toMatchObject({
        input: { type: 'approval', approvalId: 'ap-1', approved: true },
      });
    }
    expect(api.posts).toHaveLength(3);
  });

  it('gõ tin mới thay vì Retry → tin hỏng rời màn, API chỉ nhận tin mới', async () => {
    api.turns.push(json(429, { code: 'TOO_MANY_REQUESTS' }), sse(textReply('a1', 'Sure.')));
    render(<ContactLauncher />);
    const user = await openChat();
    await say(user, 'First try');
    await screen.findByRole('alert');

    await say(user, 'Second try');

    expect(await screen.findByText('Sure.')).toBeInTheDocument();
    expect(screen.queryByText('First try')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ChatPanel — khôi phục hội thoại', () => {
  it('có id trong localStorage → nạp lại tin từ API khi mở khung', async () => {
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, STORED_ID);
    api.history = json(200, {
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Earlier question' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Earlier answer' }] },
      ],
    });
    render(<ContactLauncher />);
    await openChat();

    expect(await screen.findByText('Earlier answer')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`${API}/${STORED_ID}`, expect.anything());
  });

  it('404 → bỏ id cũ, bắt đầu hội thoại mới với id khác', async () => {
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, STORED_ID);
    api.turns.push(sse(textReply('a1', 'Fresh start.')));
    render(<ContactLauncher />);
    const user = await openChat();

    expect(await screen.findByRole('button', { name: t.suggestions.findTour })).toBeInTheDocument();
    expect(window.localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: t.suggestions.findTour }));
    expect(await screen.findByText('Fresh start.')).toBeInTheDocument();
    expect(api.posts[0]?.conversationId).not.toBe(STORED_ID);
  });
});

describe('ChatPanel — đóng mở', () => {
  it('Esc đóng khung và trả tiêu điểm về nút', async () => {
    render(<ContactLauncher />);
    const user = await openChat();
    expect(screen.getByRole('textbox', { name: t.inputLabel })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: t.title })).toBeNull();
    expect(
      screen.getByRole('button', { name: messages.contactLauncher.triggerAria }),
    ).toHaveFocus();
  });
});

describe('ChatMarkdown — link trong câu trả lời', () => {
  it('link nội bộ bấm được; link ngoài và //host chỉ còn chữ', () => {
    render(
      <ChatMarkdown text="See [the tour](/tours/ha-long-2d1n), [a scam](https://evil.example) and [b](//evil.example)." />,
    );
    expect(screen.getByRole('link', { name: 'the tour' })).toHaveAttribute(
      'href',
      '/tours/ha-long-2d1n',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('a scam')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('/\\host: markdown mã hoá dấu gạch ngược thành %5C, nên link vẫn là một path của site', () => {
    render(<ChatMarkdown text="[c](/\evil.example)" />);
    expect(screen.getByRole('link', { name: 'c' })).toHaveAttribute('href', '/%5Cevil.example');
  });

  it('không nhận HTML trong chữ của model', () => {
    const { container } = render(<ChatMarkdown text={'Hi <img src=x onerror=alert(1)> there'} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
