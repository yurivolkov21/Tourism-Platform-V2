import { type ChatRequest, TourSlugSchema } from '@tourism/contract';
import { APICallError, isToolUIPart, type UIMessage } from 'ai';

/**
 * Logic thuần của khung chat trợ lý (P6, spec §2b, §2h): dựng body `POST /api/chat`
 * từ danh sách tin của `useChat`, đọc lỗi API thành loại để khung chọn câu, và đọc
 * slug tour từ đường dẫn.
 */

/** Khoá localStorage giữ id hội thoại giữa các lần tải trang. */
export const CONVERSATION_STORAGE_KEY = 'nexora.concierge.conversation';

/**
 * Tin cuối → body request. Trình duyệt không gửi lịch sử (ADR-0050 §2): tin cuối của
 * khách thành `input` chữ; tin cuối là trả lời có phần tool vừa được khách quyết thì
 * thành `input` duyệt. `null` khi không có gì để gửi.
 */
export function toChatRequest(
  messages: UIMessage[],
  conversationId: string,
  tourSlug: string | null,
): ChatRequest | null {
  const last = messages.at(-1);
  if (last === undefined) return null;
  const input = last.role === 'user' ? textInput(last) : approvalInput(last);
  if (input === null) return null;
  return { conversationId, ...(tourSlug === null ? {} : { tourSlug }), input };
}

function textInput(message: UIMessage): ChatRequest['input'] | null {
  const text = message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
  return text === '' ? null : { type: 'message', text };
}

function approvalInput(message: UIMessage): ChatRequest['input'] | null {
  // Phần mới quyết nằm cuối tin; API tự từ chối các phần chờ khác nếu có.
  for (const part of [...message.parts].reverse()) {
    if (isToolUIPart(part) && part.state === 'approval-responded') {
      return { type: 'approval', approvalId: part.approval.id, approved: part.approval.approved };
    }
  }
  return null;
}

export type ConciergeErrorKind =
  | 'busy'
  | 'rateLimited'
  | 'turnLimit'
  | 'unavailable'
  | 'expired'
  | 'generic';

/**
 * Lỗi của `useChat` → loại lỗi theo bảng spec §2b. Lỗi HTTP đến dưới dạng
 * `APICallError` mang mã trạng thái và thân envelope; lỗi giữa stream và lỗi mạng là
 * `Error` thường, nên rơi về `generic` (Retry).
 */
export function errorKind(error: unknown): ConciergeErrorKind {
  if (!APICallError.isInstance(error)) return 'generic';
  if (error.statusCode === 429) return 'rateLimited';
  switch (envelopeCode(error.responseBody)) {
    case 'CHAT_BUSY':
      return 'busy';
    case 'CHAT_TURN_LIMIT':
      return 'turnLimit';
    case 'CHAT_NOT_FOUND':
      return 'expired';
    case 'CHAT_UNAVAILABLE':
      return 'unavailable';
  }
  // 503 không có envelope (proxy của nền tảng khi API đang dậy) cũng là "nghỉ".
  return error.statusCode === 503 ? 'unavailable' : 'generic';
}

function envelopeCode(body: string | undefined): string | null {
  if (body === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' &&
      parsed !== null &&
      'code' in parsed &&
      typeof parsed.code === 'string'
      ? parsed.code
      : null;
  } catch {
    return null;
  }
}

/**
 * Slug tour đang xem từ đường dẫn (`/tours/<slug>` và các trang con book, enquire).
 * Chỉ nhận slug đúng khuôn của contract, vì API cũng chặn đúng khuôn ấy.
 */
export function tourSlugFromPath(pathname: string): string | null {
  const match = /^\/tours\/([^/]+)/.exec(pathname);
  if (match?.[1] === undefined) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    // `%` lẻ trong URL gõ tay: không phải slug nào cả.
    return null;
  }
  const parsed = TourSlugSchema.safeParse(segment);
  return parsed.success ? parsed.data : null;
}
