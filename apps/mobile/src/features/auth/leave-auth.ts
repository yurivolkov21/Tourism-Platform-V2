import type { Href } from 'expo-router';
import { type RefObject, useEffect, useRef } from 'react';

/** Phần `router` mà `leaveAuthTo` cần — tách ra để test không phải dựng router. */
export interface LeaveAuthNavigator {
  dismissTo(href: Href): void;
  navigate(href: Href): void;
}

/**
 * Rời nhóm (auth) sau khi đăng nhập/đăng ký xong, về đúng `path` đã ghi ở
 * return-to (`null` = không ai ghi → Home).
 *
 * - Màn auth còn nằm trên stack (`authOnStack`, đường thường): `dismissTo` gỡ
 *   modal và lùi về đúng màn đang nằm dưới. Trước đây `router.replace` dựng một
 *   tour MỚI thay chỗ modal → tour bị nhân đôi, phải back hai lần (R3). Đích
 *   không có trong stack thì `dismissTo` tự thay chỗ màn auth — đó là đường
 *   Sign in mở từ onboarding: `(auth)` là màn gốc DUY NHẤT, dưới nó không có gì.
 * - Màn auth đã bị gỡ trong lúc chờ (Android: link callback OAuth
 *   `callbackURL: '/'` đưa stack về `(tabs)`): `navigate` ĐẨY đích lên trên
 *   tabs. Thay chỗ ở đây là thay luôn tabs → tour thành màn duy nhất, back là
 *   thoát app (R2).
 *
 * KHÔNG phân biệt hai đường bằng `router.canDismiss()`: nó trả `false` ở cả
 * stack chỉ còn `(tabs)` (R2) lẫn stack chỉ còn `(auth)` (mở từ onboarding),
 * mà hai đường cần cách rời ngược nhau — dùng nó là Sign in nằm lại dưới Home,
 * back cứng quay về màn Sign in có nút kẹt "Signing in…" (review 12/10).
 */
export function leaveAuthTo(
  nav: LeaveAuthNavigator,
  path: string | null,
  authOnStack: boolean,
): void {
  // `path` do màn chặn tự ghi bằng route có thật (`/tours/<slug>`, `/explore`).
  const target = (path ?? '/') as Href;
  if (authOnStack) nav.dismissTo(target);
  else nav.navigate(target);
}

/**
 * `true` khi màn còn mount — đọc SAU `await` để biết màn auth còn trên stack
 * không (đăng nhập Google chờ trình duyệt, đủ lâu để callback OAuth gỡ cả nhóm
 * auth). Gán lại `true` trong effect vì StrictMode chạy effect hai lần ở dev:
 * cleanup lần đầu đã gán `false`.
 */
export function useStillMounted(): RefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
