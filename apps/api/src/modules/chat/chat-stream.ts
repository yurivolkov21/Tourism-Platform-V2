import type { ServerResponse } from 'node:http';
import { JsonToSseTransformStream, UI_MESSAGE_STREAM_HEADERS, type UIMessageChunk } from 'ai';

/**
 * Hai mảnh stream của `POST /api/chat` (spec §2b, §4) — tách khỏi controller để test
 * được bằng stream giả.
 */

/** Chunk mở đầu chưa mang nội dung gì: gặp lỗi trước khi qua hết chúng thì còn kịp 503. */
const PRELUDE_CHUNKS: ReadonlySet<string> = new Set(['start', 'start-step', 'message-metadata']);

export type PeekResult<T> = { ok: true; stream: ReadableStream<T> } | { ok: false };

/**
 * Đọc trước tới chunk nội dung đầu tiên (plan, quyết định 5). `streamText` lười nên
 * lỗi Anthropic (khoá sai, hết tiền, quá tải) chỉ hiện thành chunk `error` trong
 * stream; đọc trước cho phép trả 503 dạng JSON trước khi gửi header 200. Qua được thì
 * trả một stream phát lại phần đã đọc rồi nối tiếp phần còn lại.
 */
export async function peekUntilContent<T extends { type: string }>(
  stream: ReadableStream<T>,
): Promise<PeekResult<T>> {
  const reader = stream.getReader();
  const buffered: T[] = [];
  for (;;) {
    let next: ReadableStreamReadResult<T>;
    try {
      next = await reader.read();
    } catch {
      return { ok: false };
    }
    if (next.done) return { ok: true, stream: replay(buffered, reader, true) };
    if (next.value.type === 'error') {
      reader.cancel().catch(() => {});
      return { ok: false };
    }
    buffered.push(next.value);
    if (!PRELUDE_CHUNKS.has(next.value.type)) {
      return { ok: true, stream: replay(buffered, reader, false) };
    }
  }
}

function replay<T>(
  buffered: readonly T[],
  reader: ReadableStreamDefaultReader<T>,
  sourceDone: boolean,
): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
      if (sourceDone) controller.close();
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * Ghi stream UI message thành SSE thẳng lên `reply.raw` (Fastify đã `hijack`).
 *
 * Không dùng `pipeUIMessageStreamToResponse` của SDK: nó không nghe `close` của
 * socket, nên khi khách đóng tab nó chờ `drain` mãi mãi và giữ cả nhánh stream trong
 * bộ nhớ. Ở đây khách đi thì huỷ nhánh của khách; nhánh server (tee ở `ChatService`)
 * vẫn chạy trọn lượt để ghi tin và token.
 *
 * `headers` là header Fastify đã đặt trên `reply` (CORS, helmet) — `hijack` bỏ qua
 * chúng nên phải chép tay, thiếu là trình duyệt chặn đọc response cross-origin.
 */
export async function writeUIMessageStream(
  raw: ServerResponse,
  headers: Record<string, string | number | readonly string[] | undefined>,
  stream: ReadableStream<UIMessageChunk>,
): Promise<void> {
  const reader = stream
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream())
    .getReader();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) raw.setHeader(name, value);
  }
  raw.writeHead(200, UI_MESSAGE_STREAM_HEADERS);

  let closed = false;
  const onClose = () => {
    closed = true;
    reader.cancel().catch(() => {});
  };
  raw.once('close', onClose);
  try {
    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!raw.write(value)) {
        await new Promise<void>((resolve) => {
          const settle = () => {
            raw.off('drain', settle);
            raw.off('close', settle);
            resolve();
          };
          raw.once('drain', settle);
          raw.once('close', settle);
        });
      }
    }
  } catch {
    // Đọc lỗi sau khi khách đi (nhánh bị huỷ) — không còn ai để báo.
  } finally {
    raw.off('close', onClose);
    if (!raw.writableEnded) raw.end();
  }
}
