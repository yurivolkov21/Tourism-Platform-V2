import type { ChatRequest } from '@tourism/contract';
import { isToolUIPart, type UIMessage } from 'ai';

/**
 * Lịch sử hội thoại phía server (ADR-0050 §3, spec §2f) — phần thuần, không chạm DB.
 *
 * Trình duyệt chỉ gửi MỘT tin mới hoặc MỘT quyết định duyệt; toàn bộ lịch sử đưa
 * cho model dựng ở đây từ các hàng đã ghi. Vì khách không bao giờ gửi phần tool
 * nào lên, họ không giả được một approval đã duyệt hay một kết quả tool — nên không
 * cần chữ ký approval của SDK (`experimental_toolApprovalSecret`).
 */

/** Một hàng `chat_messages` đã đọc ra, `payload` là đúng một UIMessage. */
export interface StoredChatRow {
  seq: number;
  role: 'USER' | 'ASSISTANT';
  message: UIMessage;
}

export type ChatTurnInput = ChatRequest['input'];

export type PreparedTurn =
  | {
      ok: true;
      kind: 'message';
      /** `seq` của tin khách; tin trả lời lấy `userSeq + 1`. */
      userSeq: number;
      userMessage: UIMessage;
      /** Tin trả lời cũ phải ghi đè vì approval đang chờ của nó vừa bị tự từ chối. */
      rewritten?: { seq: number; message: UIMessage };
      /** Toàn bộ lịch sử đưa cho model, đã gồm tin khách mới. */
      messages: UIMessage[];
    }
  | {
      ok: true;
      kind: 'approval';
      /** `seq` của tin trả lời đang chờ — phần tiếp của lượt ghi đè đúng hàng này. */
      pendingSeq: number;
      messages: UIMessage[];
    }
  | { ok: false; reason: 'approval-not-pending' };

type MessagePart = UIMessage['parts'][number];

/**
 * Lý do đi kèm approval bị từ chối, để model biết thẻ đã đóng và vì sao. Thiếu lý do thì SDK
 * gửi model câu mặc định "Tool call execution denied." như một lỗi, và model nói "I'm unable
 * to process this enquiry" sau khi khách bấm Cancel (B3 thử 19/10). Câu "did not press Send"
 * cũng hỏng: model hiểu là "chưa bấm" và bảo khách bấm Send (B3 thử lại sau PR #42). Viết
 * bằng tiếng Anh vì là chữ cho model, không phải copy khách đọc.
 */
export const ENQUIRY_CANCELLED_REASON =
  'The visitor pressed Cancel on the confirmation card. The enquiry was not sent and the card is closed, so there is nothing left to press. This was their choice, not an error: tell them nothing was sent.';

/** Thẻ bị đóng vì khách gõ tin khác, hoặc vì khách trả lời một thẻ khác cùng tin. */
export const ENQUIRY_SKIPPED_REASON =
  'The visitor moved on without pressing Send or Cancel. The enquiry was not sent and the card is closed. This is not an error.';

export function countUserMessages(rows: readonly StoredChatRow[]): number {
  return rows.filter((row) => row.role === 'USER').length;
}

export function nextSeq(rows: readonly StoredChatRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.seq), 0) + 1;
}

/** Phần tool đang chờ khách bấm Send/Cancel. Approval tự động của SDK không tính. */
function isPendingApproval(part: MessagePart): boolean {
  return (
    isToolUIPart(part) && part.state === 'approval-requested' && part.approval.isAutomatic !== true
  );
}

/**
 * Trả lời một phần đang chờ. `approval-responded` để `streamText` tự chạy tool (được
 * duyệt) hay báo `execution-denied` kèm `reason` cho model (bị từ chối) ở lượt này.
 */
function respond(part: MessagePart, approved: boolean, reason: string): MessagePart {
  if (!isToolUIPart(part) || part.state !== 'approval-requested') return part;
  const approval = approved
    ? { ...part.approval, approved }
    : { ...part.approval, approved, reason };
  return { ...part, state: 'approval-responded', approval };
}

/**
 * Đóng hẳn một phần đang chờ thành `output-denied`. Dùng khi khách gõ tin mới thay
 * vì bấm thẻ: SDK chỉ xử lý approval nằm ở tin CUỐI, nên phần đang chờ ở tin cũ phải
 * mang sẵn trạng thái cuối, không thì model gặp một lời gọi tool không có kết quả.
 */
function deny(part: MessagePart): MessagePart {
  if (!isToolUIPart(part) || part.state !== 'approval-requested') return part;
  return {
    ...part,
    state: 'output-denied',
    approval: { ...part.approval, approved: false, reason: ENQUIRY_SKIPPED_REASON },
  } as MessagePart;
}

/**
 * Dựng lượt mới từ lịch sử đã ghi và đầu vào của khách.
 *
 * - Tin chữ: nối vào cuối. Nếu tin trả lời cuối còn approval đang chờ, approval ấy
 *   bị tự từ chối (spec §2c: gõ tiếp nghĩa là không gửi) và tin đó được ghi đè.
 * - Quyết định duyệt: chỉ hợp lệ với approval đang chờ ở tin trả lời CUỐI. Approval
 *   khác cùng chờ trong tin đó (lưới phòng `disableParallelToolUse` hỏng) tự bị từ
 *   chối, để model không gặp lời gọi tool treo.
 */
export function prepareTurn(
  rows: readonly StoredChatRow[],
  input: ChatTurnInput,
  newUserMessageId: string,
): PreparedTurn {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const messages = sorted.map((row) => row.message);
  const last = sorted.at(-1);

  if (input.type === 'message') {
    const userMessage: UIMessage = {
      id: newUserMessageId,
      role: 'user',
      parts: [{ type: 'text', text: input.text }],
    };
    let rewritten: { seq: number; message: UIMessage } | undefined;
    if (last?.role === 'ASSISTANT' && last.message.parts.some(isPendingApproval)) {
      const message = { ...last.message, parts: last.message.parts.map(deny) };
      rewritten = { seq: last.seq, message };
      messages[messages.length - 1] = message;
    }
    return {
      ok: true,
      kind: 'message',
      userSeq: nextSeq(rows),
      userMessage,
      ...(rewritten ? { rewritten } : {}),
      messages: [...messages, userMessage],
    };
  }

  const target = last?.role === 'ASSISTANT' ? last : undefined;
  const hasTarget = target?.message.parts.some(
    (part) =>
      isPendingApproval(part) && isToolUIPart(part) && part.approval?.id === input.approvalId,
  );
  if (!target || !hasTarget) return { ok: false, reason: 'approval-not-pending' };

  const message: UIMessage = {
    ...target.message,
    parts: target.message.parts.map((part) => {
      if (!isPendingApproval(part) || !isToolUIPart(part)) return part;
      return part.approval?.id === input.approvalId
        ? respond(part, input.approved, ENQUIRY_CANCELLED_REASON)
        : respond(part, false, ENQUIRY_SKIPPED_REASON);
    }),
  };
  messages[messages.length - 1] = message;
  return { ok: true, kind: 'approval', pendingSeq: target.seq, messages };
}
