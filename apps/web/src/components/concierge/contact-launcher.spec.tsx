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
  history: Response | null;
  turns: Array<Response | (() => Response)>;
  posts: Array<Record<string, unknown>>;
}

let api: FakeApi;

beforeEach(() => {
  navigation.pathname = '/';
  window.localStorage.clear();
  api = { available: true, history: null, turns: [], posts: [] };
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
      if (url === API) return json(200, { available: api.available });
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
  await user.click(await screen.findByRole('button', { name: /Chat with us/ }));
  return user;
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: t.inputLabel }), text);
  await user.click(screen.getByRole('button', { name: t.sendAria }));
}

describe('ContactLauncher — popover', () => {
  it('API báo không sẵn sàng → chỉ còn lối enquiry, trỏ /contact', async () => {
    api.available = false;
    const user = userEvent.setup();
    render(<ContactLauncher />);
    await user.click(screen.getByRole('button', { name: messages.contactLauncher.triggerAria }));

    const enquiry = await screen.findByRole('link', { name: /Send an enquiry/ });
    expect(enquiry).toHaveAttribute('href', '/contact');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(API));
    expect(screen.queryByRole('button', { name: /Chat with us/ })).toBeNull();
  });

  it('sẵn sàng → có "Chat with us"; ở trang tour thì enquiry trỏ form của tour', async () => {
    navigation.pathname = '/tours/ha-long-2d1n';
    const user = userEvent.setup();
    render(<ContactLauncher />);
    await user.click(screen.getByRole('button', { name: messages.contactLauncher.triggerAria }));

    expect(await screen.findByRole('button', { name: /Chat with us/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Send an enquiry/ })).toHaveAttribute(
      'href',
      '/tours/ha-long-2d1n/enquire',
    );
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
    expect(api.posts[1]).toMatchObject({ input: { type: 'message', text: 'Actually, wait' } });
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
