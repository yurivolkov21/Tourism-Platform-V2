import { z } from 'zod';
import { TourSlugSchema } from './admin-tours.js';

/**
 * Hợp đồng chung của trợ lý AI (P6, ADR-0050 §1) giữa web và API.
 *
 * Ba endpoint chat là route Nest THUẦN ngoài oRPC (stream theo giao thức UI
 * message của AI SDK), nên không có procedure trong `contract.ts`; schema ở đây
 * là thứ giữ hai đầu khớp nhau.
 *
 * Trình duyệt KHÔNG BAO GIỜ gửi lịch sử (ADR-0050 §2): mỗi request mang đúng
 * một tin chữ mới hoặc một quyết định duyệt. Gửi được lịch sử là sửa được kết
 * quả tool — giá, chỗ trống — rồi đưa cho model như sự thật.
 */

/** Trần dùng chung cho web (đếm ký tự, khoá ô gõ) và API (cổng trước model). */
export const CHAT_LIMITS = {
  /** Một tin của khách, tính sau khi trim. */
  messageMaxLength: 1000,
  /** Số tin khách tối đa trong một hội thoại (spec §2e). */
  userMessagesPerConversation: 20,
} as const;

/** Tin chữ mới của khách. */
export const ChatMessageInputSchema = z.object({
  type: z.literal('message'),
  text: z.string().trim().min(1).max(CHAT_LIMITS.messageMaxLength),
});

/**
 * Quyết định của khách cho một tool đang chờ duyệt (`submitEnquiry`). API tự
 * tìm phần tool có `approval.id` khớp trong tin trả lời đã LƯU; id không còn chờ
 * là 400 — trình duyệt không áp được gì lên lịch sử.
 */
export const ChatApprovalInputSchema = z.object({
  type: z.literal('approval'),
  // Id do AI SDK sinh (chuỗi ngắn); trần chỉ chặn chuỗi rác dài.
  approvalId: z.string().min(1).max(200),
  approved: z.boolean(),
});

export const ChatRequestSchema = z.object({
  /** UUID trình duyệt sinh ở tin đầu, giữ trong localStorage. */
  conversationId: z.uuid(),
  /**
   * Slug trang tour đang xem, nếu có. Đi vào prompt hệ thống, nên dùng đúng
   * khuôn slug chặt (không khoảng trắng, không chữ hoa) — chuỗi tự do ở đây là
   * một cửa nhồi lệnh vào prompt.
   */
  tourSlug: TourSlugSchema.optional(),
  input: z.discriminatedUnion('type', [ChatMessageInputSchema, ChatApprovalInputSchema]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** `GET /api/chat` — có hiện lựa chọn chat ở nút nổi không. */
export const ChatStatusSchema = z.object({ available: z.boolean() });

export type ChatStatus = z.infer<typeof ChatStatusSchema>;

/**
 * Mã lỗi riêng của chat (spec §2b). 429 của trần IP đi qua guard chung nên
 * mang mã `TOO_MANY_REQUESTS` của envelope, không nằm trong danh sách này.
 */
export const CHAT_ERROR_CODES = [
  'INVALID_INPUT',
  'CHAT_NOT_FOUND',
  'CHAT_TURN_LIMIT',
  'CHAT_BUSY',
  'CHAT_UNAVAILABLE',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];
