import type { Href } from 'expo-router';

/** Phần `router` mà `leaveAuthTo` cần — tách ra để test không phải dựng router. */
export interface LeaveAuthNavigator {
  canDismiss(): boolean;
  dismissTo(href: Href): void;
  navigate(href: Href): void;
}

/**
 * Rời nhóm (auth) sau khi đăng nhập/đăng ký xong, về đúng `path` đã ghi ở
 * return-to (`null` = không ai ghi → Home).
 *
 * - Modal còn nằm trên stack (đường thường): `dismissTo` gỡ modal và lùi về
 *   đúng màn đang nằm dưới. Trước đây `router.replace` dựng một tour MỚI thay
 *   chỗ modal → tour bị nhân đôi, phải back hai lần (R3).
 * - Không còn gì để gỡ (Android: link callback OAuth `callbackURL: '/'` đưa
 *   stack về `(tabs)`): `navigate` ĐẨY đích lên trên tabs. `replace` ở đây là
 *   thay luôn tabs → tour thành màn duy nhất, back là thoát app (R2).
 */
export function leaveAuthTo(nav: LeaveAuthNavigator, path: string | null): void {
  // `path` do màn chặn tự ghi bằng route có thật (`/tours/<slug>`, `/explore`).
  const target = (path ?? '/') as Href;
  if (nav.canDismiss()) nav.dismissTo(target);
  else nav.navigate(target);
}
