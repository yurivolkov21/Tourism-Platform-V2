import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useSyncExternalStore } from 'react';
import { apiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của web (ADR-0017 §1) — cookie httpOnly do API
 * phát, browser gọi thẳng origin API (không proxy, không Bearer). baseURL
 * dùng lại apiOrigin() — không lặp base-URL (bài học Nexora 8 file).
 *
 * `inferAdditionalFields` (Task 7/A2): khai LẠI đúng shape `additionalFields.
 * phone` của server (`apps/api/src/auth/auth.config.ts`) — CHỈ để `authClient.
 * updateUser({ name, phone })` (`profile-form.tsx`) type-check được `phone`.
 * Không import type từ `apps/api` (hai app deploy tách rời, ADR-0016) nên
 * phải khai tay; server vẫn là chốt validate thật (body server-side là
 * `z.record` — chấp nhận field lạ, xem JSDoc `update-user.mjs` đối chiếu ở
 * `profile-form.tsx`), khai sai ở đây chỉ lệch TYPE, không lệch RUNTIME.
 */
export const authClient = createAuthClient({
  // CHỈ tính origin trong browser (vòng vá review W3, cùng khuôn admin):
  // module này bị evaluate cả lúc `next build` prerender (NODE_ENV=production)
  // — apiOrigin() nay fail-fast nên gọi ở module scope phía server là giết
  // build với env dev; client Better Auth chỉ được GỌI từ browser, baseURL
  // phía server để undefined vô hại.
  baseURL: typeof window === 'undefined' ? undefined : apiOrigin(),
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: { phone: { type: 'string', required: false } },
    }),
  ],
});

type SessionState = ReturnType<typeof authClient.useSession>;

// Ba hàm ở module scope để identity ổn định (cùng khuôn `sortable.tsx` của
// @tourism/ui): subscription không bao giờ báo đổi nên `useSyncExternalStore` trả
// snapshot server (`false`) lúc render ở server VÀ lúc hydrate, rồi `true` từ đó về sau.
const subscribeToNothing = () => () => {};
const getIsHydrated = () => true;
const getIsHydratedOnServer = () => false;

/**
 * `useSession` an toàn cho hydrate — mọi island session (ADR-0017 §2) đọc QUA ĐÂY,
 * đừng gọi thẳng `authClient.useSession()`.
 *
 * Lỗi 15/09 (navbar ở /account): server không bao giờ biết session (§2 cấm đọc session
 * ở layout public), atom session của Better Auth phía server luôn là `{ data: null,
 * isPending: true }` nên HTML luôn là nhánh "Log in". Nhưng `useStore` của
 * `better-auth/react` 1.6.23 (`dist/client/react/react-store.mjs`) đưa CÙNG một getter
 * sống làm cả `getSnapshot` lẫn `getServerSnapshot`, nên lượt hydrate đọc giá trị atom
 * đang có ở client chứ không phải giá trị server đã render. Atom tự mount ở lần
 * `store.get()` đầu tiên trong render (nanostores) và bắn `/get-session`; Next hydrate
 * trong `startTransition` (nhường luồng, chờ chunk), nên island nào hydrate SAU khi
 * request đó về sẽ render avatar đè lên HTML "Log in" → "Hydration failed…".
 *
 * Chữa: lượt render ở server và lượt hydrate trả đúng trạng thái khởi tạo của atom
 * (thứ server đã render), hydrate xong React tự render lại với session thật. Island
 * mount SAU hydrate (điều hướng client) đọc `getSnapshot` nên thấy session ngay —
 * vì vậy KHÔNG dùng `useEffect` + state, cách đó chớp "Log in" ở mọi lần mount.
 */
export function useSession(): SessionState {
  const session = authClient.useSession();
  const hydrated = useSyncExternalStore(subscribeToNothing, getIsHydrated, getIsHydratedOnServer);
  if (hydrated) return session;
  return { ...session, data: null, error: null, isPending: true, isRefetching: false };
}
