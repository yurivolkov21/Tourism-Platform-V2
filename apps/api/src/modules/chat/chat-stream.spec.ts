import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import type { UIMessageChunk } from 'ai';
import { peekUntilContent, writeUIMessageStream } from './chat-stream.js';

type Chunk = { type: string; id?: string };

function streamOf<T>(chunks: T[], { error }: { error?: Error } = {}): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (error) controller.error(error);
      else controller.close();
    },
  });
}

async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

describe('peekUntilContent', () => {
  it('chunk lỗi tới trước nội dung → không ok (trả 503 được)', async () => {
    const result = await peekUntilContent(
      streamOf<Chunk>([{ type: 'start' }, { type: 'start-step' }, { type: 'error' }]),
    );
    expect(result.ok).toBe(false);
  });

  it('stream lỗi hẳn trước nội dung → không ok', async () => {
    const result = await peekUntilContent(
      streamOf<Chunk>([{ type: 'start' }], { error: new Error('boom') }),
    );
    expect(result.ok).toBe(false);
  });

  it('có nội dung thì phát lại đủ mọi chunk theo đúng thứ tự, gồm cả phần chưa đọc', async () => {
    const chunks: Chunk[] = [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't' },
      { type: 'error' },
      { type: 'finish' },
    ];
    const result = await peekUntilContent(streamOf(chunks));
    if (!result.ok) throw new Error('expected ok');
    // Lỗi SAU nội dung là lỗi giữa stream: đi tiếp tới web, không phải 503.
    expect(await readAll(result.stream)).toEqual(chunks);
  });

  it('lượt duyệt mở đầu bằng kết quả tool cũng là nội dung', async () => {
    const result = await peekUntilContent(
      streamOf<Chunk>([{ type: 'start' }, { type: 'tool-output-available' }]),
    );
    expect(result.ok).toBe(true);
  });

  it('stream rỗng không lỗi → ok, phát lại phần mở đầu', async () => {
    const result = await peekUntilContent(streamOf<Chunk>([{ type: 'start' }, { type: 'finish' }]));
    if (!result.ok) throw new Error('expected ok');
    expect(await readAll(result.stream)).toEqual([{ type: 'start' }, { type: 'finish' }]);
  });

  it('stream kết thúc khi mới có phần mở đầu → ok', async () => {
    const result = await peekUntilContent(streamOf<Chunk>([{ type: 'start' }]));
    if (!result.ok) throw new Error('expected ok');
    expect(await readAll(result.stream)).toEqual([{ type: 'start' }]);
  });
});

/** ServerResponse giả: ghi lại header, phần thân và cho giả lập khách đóng tab. */
class FakeResponse extends EventEmitter {
  headers: Record<string, unknown> = {};
  status = 0;
  body = '';
  writableEnded = false;
  setHeader(name: string, value: unknown) {
    this.headers[name.toLowerCase()] = value;
  }
  writeHead(status: number, headers: Record<string, string>) {
    this.status = status;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
  }
  write(chunk: Uint8Array) {
    this.body += new TextDecoder().decode(chunk);
    return true;
  }
  end() {
    this.writableEnded = true;
  }
}

describe('writeUIMessageStream', () => {
  const chunks: UIMessageChunk[] = [
    { type: 'start' },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'Hi' },
    { type: 'text-end', id: 't' },
    { type: 'finish' },
  ];

  it('chép header CORS của reply rồi ghi SSE với header của giao thức UI message', async () => {
    const res = new FakeResponse();
    await writeUIMessageStream(
      res as unknown as ServerResponse,
      { 'access-control-allow-origin': 'https://www.example.com', 'x-frame-options': 'SAMEORIGIN' },
      streamOf(chunks),
    );
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://www.example.com');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.headers['x-vercel-ai-ui-message-stream']).toBe('v1');
    expect(res.body).toContain('data: {"type":"text-delta","id":"t","delta":"Hi"}');
    expect(res.body.trimEnd().endsWith('data: [DONE]')).toBe(true);
    expect(res.writableEnded).toBe(true);
  });

  it('khách đóng tab giữa chừng → huỷ nhánh của khách và kết thúc, không treo', async () => {
    const res = new FakeResponse();
    let cancelled = false;
    let controllerRef: ReadableStreamDefaultController<UIMessageChunk> | undefined;
    const endless = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controllerRef = controller;
        controller.enqueue({ type: 'start' });
      },
      cancel() {
        cancelled = true;
      },
    });
    const done = writeUIMessageStream(res as unknown as ServerResponse, {}, endless);
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.emit('close');
    controllerRef?.enqueue({ type: 'start-step' });
    await done;
    // Huỷ lan ngược qua hai tầng pipeThrough một cách bất đồng bộ.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cancelled).toBe(true);
    expect(res.writableEnded).toBe(true);
  });
});
