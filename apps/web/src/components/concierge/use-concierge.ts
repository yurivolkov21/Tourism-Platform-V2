'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserApiOrigin } from '@/lib/api/env';
import { CONVERSATION_STORAGE_KEY, errorKind, toChatRequest } from '@/lib/concierge';

/** Bản nháp enquiry model đưa lên thẻ xác nhận (input của tool `submitEnquiry`). */
export interface EnquiryDraft {
  name: string;
  email: string;
  message: string;
  tourSlug?: string;
  travelDate?: string;
  groupSize?: number;
}

/** Kết quả của `submitEnquiry` sau khi khách bấm Send (chat-tools.ts phía API). */
export type EnquiryOutcome = { sent: true } | { sent: false; reason: 'already_sent' };

// Chỉ `submitEnquiry` cần kiểu: các tool đọc chỉ hiện dòng trạng thái, không đọc kết quả.
// Hai tool đọc đơn chỉ có ở lượt có phiên (ADR-0050 AMEND 2).
type ConciergeTools = {
  searchTours: { input: unknown; output: unknown };
  getTourDetails: { input: unknown; output: unknown };
  submitEnquiry: { input: EnquiryDraft; output: EnquiryOutcome };
  listMyBookings: { input: unknown; output: unknown };
  getMyBooking: { input: unknown; output: unknown };
};

export type ConciergeMessage = UIMessage<unknown, UIDataTypes, ConciergeTools>;

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
  } catch {
    // Chế độ riêng tư hay site data bị chặn: hội thoại chỉ sống trong trang.
    return null;
  }
}

function writeStoredId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    else window.localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
  } catch {
    // Như trên: không lưu được thì thôi.
  }
}

/**
 * Quên hội thoại đang lưu trên trình duyệt — lúc phiên rời một tài khoản (ADR-0050 AMEND 2).
 * Khung đang mount phải được dỡ cùng lúc thì tin trong bộ nhớ mới mất theo.
 */
export function forgetStoredConversation(): void {
  writeStoredId(null);
}

/**
 * Trạng thái khung chat (P6, spec §2h). Chỉ gọi khi khung đã mở lần đầu: id hội thoại
 * có trong localStorage thì nạp lại tin từ `GET /api/chat/:id` đúng một lần lúc ấy, không
 * ở mỗi lần tải trang.
 *
 * Mỗi request chỉ mang tin cuối (`toChatRequest`), lịch sử nằm ở API. Lượt duyệt tự gửi
 * khi khách bấm Send hay Cancel trên thẻ (`sendAutomaticallyWhen`).
 */
export function useConcierge(tourSlug: string | null) {
  const [stored] = useState(readStoredId);
  const [conversationId, setConversationId] = useState(() => stored ?? crypto.randomUUID());
  const [restoring, setRestoring] = useState(stored !== null);

  // Transport dựng một lần; slug đọc qua ref để khách đổi trang mà khung vẫn mở thì
  // request sau mang đúng tour đang xem.
  const tourSlugRef = useRef(tourSlug);
  tourSlugRef.current = tourSlug;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ConciergeMessage>({
        api: `${browserApiOrigin()}/api/chat`,
        credentials: 'include',
        prepareSendMessagesRequest: ({ id, messages }) => {
          const body = toChatRequest(messages, id, tourSlugRef.current);
          if (body === null) throw new Error('Nothing to send');
          return { body };
        },
      }),
    [],
  );

  const chat = useChat<ConciergeMessage>({
    id: conversationId,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  // Ref chứ không phải dependency: đổi id là `setMessages` đổi theo phiên mới, và effect
  // nạp lại không được chạy lần hai cho id cũ.
  const setMessagesRef = useRef(chat.setMessages);
  setMessagesRef.current = chat.setMessages;
  const restoreRef = useRef<AbortController | null>(null);

  const startOver = useCallback(() => {
    restoreRef.current?.abort();
    writeStoredId(null);
    // Đổi id là `useChat` dựng phiên mới rỗng và dừng phiên cũ.
    setConversationId(crypto.randomUUID());
    setRestoring(false);
  }, []);

  useEffect(() => {
    if (stored === null) return;
    const controller = new AbortController();
    restoreRef.current = controller;
    fetch(`${browserApiOrigin()}/api/chat/${stored}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { messages: ConciergeMessage[] };
        if (controller.signal.aborted) return;
        setMessagesRef.current(body.messages);
        setRestoring(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // 404 (hội thoại đã dọn hay của tài khoản khác) và lỗi mạng cùng một lối: bắt đầu
        // hội thoại mới. Nạp lại thất bại mà giữ id thì model nhớ những tin khách không thấy.
        startOver();
      });
    return () => controller.abort();
  }, [stored, startOver]);

  const send = useCallback(
    (text: string) => {
      writeStoredId(conversationId);
      chat.setMessages((current) => {
        // Lượt chữ vừa hỏng: API không ghi gì cho nó, nên bỏ cả tin khách lẫn phần trả
        // lời dở thay vì để hai tin khách nằm liền nhau trên màn mà API chỉ biết một.
        const kept = chat.error === undefined ? current : current.slice(0, lastUserIndex(current));
        // Gõ tin mới khi thẻ còn chờ là từ chối thẻ ấy — API làm y vậy (`prepareTurn`), nên
        // thẻ trên màn cũng phải thôi mời bấm.
        return kept.map(denyPendingApprovals);
      });
      return chat.sendMessage({ text });
    },
    [chat, conversationId],
  );

  const respond = useCallback(
    (approvalId: string, approved: boolean) =>
      chat.addToolApprovalResponse({ id: approvalId, approved }),
    [chat],
  );

  /**
   * Gửi lại lượt hỏng. Lượt duyệt hỏng gửi lại đúng quyết định (tin trả lời còn giữ phần
   * vừa quyết); lượt chữ hỏng thì bỏ phần trả lời dở và gửi lại tin khách — API không
   * ghi gì cho lượt hỏng nên lịch sử hai bên vẫn khớp.
   */
  const approvalFailed = chat.error !== undefined && hasRespondedApproval(chat.messages.at(-1));

  const retry = useCallback(
    () => (approvalFailed ? chat.sendMessage() : chat.regenerate()),
    [chat, approvalFailed],
  );

  return {
    messages: chat.messages,
    status: chat.status,
    errorKind: chat.error === undefined ? null : errorKind(chat.error),
    restoring,
    busy: restoring || chat.status === 'submitted' || chat.status === 'streaming',
    /** Lượt duyệt vừa hỏng: chỉ Retry mới gửi lại đúng quyết định, nên khoá ô gõ. */
    approvalFailed,
    send,
    respond,
    retry,
    startOver,
  };
}

export type Concierge = ReturnType<typeof useConcierge>;

function hasRespondedApproval(message: ConciergeMessage | undefined): boolean {
  return (
    message?.role === 'assistant' &&
    message.parts.some((part) => isToolUIPart(part) && part.state === 'approval-responded')
  );
}

function lastUserIndex(messages: ConciergeMessage[]): number {
  const index = messages.findLastIndex((message) => message.role === 'user');
  return index === -1 ? messages.length : index;
}

function denyPendingApprovals(message: ConciergeMessage): ConciergeMessage {
  if (message.role !== 'assistant') return message;
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === 'tool-submitEnquiry' && part.state === 'approval-requested'
        ? {
            ...part,
            state: 'output-denied' as const,
            approval: { id: part.approval.id, approved: false as const },
          }
        : part,
    ),
  };
}
