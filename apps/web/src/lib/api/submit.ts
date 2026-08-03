import { ORPCError } from '@orpc/client';
import { toast } from 'sonner';

/**
 * Phân loại lỗi submit của hai bề mặt GHI công khai (contact/newsletter,
 * spec 2026-08-03 §2–§3) thành 2 nhóm hiển thị.
 *
 * Ground truth (KHÔNG đoán field): gọi thật `enquiries.create` 6 lần liên
 * tiếp qua API dev cục bộ — limit `PUBLIC_WRITE_THROTTLE` 5/60s
 * (`apps/api/src/config/throttle.ts`) — và log nguyên object lỗi mà
 * `@orpc/client` 1.14.8 ném ra. Lỗi thứ 6 là instance `ORPCError` với
 * `{ defined:false, code:'TOO_MANY_REQUESTS', status:429,
 * message:'ThrottlerException: Too Many Requests', data:null }` — đúng
 * envelope `AllExceptionsFilter` (ADR-0010) mà `OpenAPILink` tự parse qua
 * `createORPCErrorFromJson` khi response không-2xx khớp shape đó (đọc
 * `@orpc/openapi-client` dist: `isORPCErrorJson` → `createORPCErrorFromJson`).
 *
 * Soi `status` (số), KHÔNG soi `code` (chuỗi câu chữ của Nest throttler) —
 * `status` là hợp đồng ổn định, `message` có thể đổi theo bản NestJS.
 */
export function classifySubmitError(error: unknown): 'throttle' | 'error' {
  if (error instanceof ORPCError && error.status === 429) {
    return 'throttle';
  }
  return 'error';
}

/** Copy toast — LUÔN truyền từ i18n (`messages.contactForm.toast`,
 * `messages.newsletterForm.toast`, `messages.unsubscribePage.toast`), helper
 * này không hardcode chuỗi nào. */
export interface SubmitToastCopy {
  title: string;
  description?: string;
}

/**
 * Wrapper mỏng gọi sonner — mount `<Toaster />` ở root layout thì hàm này gọi
 * được từ bất kỳ client component nào (spec §5).
 *
 * `throttle` cố ý dùng `toast.warning` chứ không dùng lại `toast.error`: đây
 * không phải một lỗi thật (server vẫn khoẻ, request sẽ thành công nếu thử
 * lại) — richColors của sonner tô màu vàng/cam cho warning, đỏ cho error,
 * giúp khách phân biệt "chờ chút" với "có gì đó hỏng" chỉ bằng màu.
 */
export function submitToast(kind: 'success' | 'error' | 'throttle', copy: SubmitToastCopy): void {
  const description = copy.description;
  if (kind === 'success') {
    toast.success(copy.title, { description });
    return;
  }
  if (kind === 'throttle') {
    toast.warning(copy.title, { description });
    return;
  }
  toast.error(copy.title, { description });
}
