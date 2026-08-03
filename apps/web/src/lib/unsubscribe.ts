import { UnsubscribeInputSchema } from '@tourism/contract';

export interface UnsubscribeParams {
  id: string;
  token: string;
}

/**
 * Soi `searchParams` (`?id=&token=`) của trang `/newsletter/unsubscribe`
 * (spec §4) bằng CHÍNH `UnsubscribeInputSchema` (không khai lại rule uuid) —
 * thiếu param hoặc `id` không phải uuid → `null`, page render thẳng panel
 * lỗi token mà KHÔNG gọi API (tránh một round-trip vô ích cho link hỏng).
 */
export function parseUnsubscribeParams(searchParams: {
  id?: string;
  token?: string;
}): UnsubscribeParams | null {
  const result = UnsubscribeInputSchema.safeParse(searchParams);
  return result.success ? result.data : null;
}

/**
 * 3 trạng thái panel `UnsubscribePanel` có copy riêng trong
 * `messages.unsubscribePage` (`confirm`/`unsubscribed`/`alreadyUnsubscribed`).
 * Trạng thái thứ 4 của cả TRANG (`invalidToken`) nằm NGOÀI panel — page.tsx tự
 * render khi thiếu/sai param, không dựng `UnsubscribePanel`.
 */
export type PanelState = 'confirm' | 'alreadyUnsubscribed' | 'unsubscribed';

export type PanelAction = 'unsubscribe-success' | 'resubscribe-success';

/**
 * State machine thuần cho `UnsubscribePanel` — tách khỏi component để TDD
 * không cần render. POST unsubscribe thành công → `unsubscribed`. POST
 * resubscribe thành công → QUAY VỀ `confirm` (không có copy "resubscribed"
 * riêng, chỉ `toast.resubscribed`) — token dùng lại được (contract thiết kế
 * idempotent), nên khách resubscribe xong lại thấy nút "Unsubscribe me" y
 * như lần đầu, toast "Welcome back" đủ báo hiệu khoảnh khắc vừa xảy ra.
 * `current` giữ tham số để đọc code rõ ý, bản thân không rẽ nhánh theo nó.
 */
export function nextPanelState(_current: PanelState, action: PanelAction): PanelState {
  return action === 'unsubscribe-success' ? 'unsubscribed' : 'confirm';
}
