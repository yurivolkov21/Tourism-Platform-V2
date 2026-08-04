# Plan — Cụm A bước 8–10: hạ tầng session client + khu Account

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** 6 route `/account/*` sống thật (dashboard · bookings list/detail ·
profile hợp nhất · security-redirect · saved) trên nền session client hoàn
chỉnh — theo [spec](../specs/2026-08-04-account-area-design.md) (Approved
04/08), **HAI PHA có MỐC DỪNG**: A1 tĩnh → user chốt visual → A2 wire.

**Architecture:** `proxy.ts` matcher hẹp + defense-in-depth từng page
(ADR-0017 §3); data per-user `no-store` không tag (tách hẳn cache
catalogue); mock nội-bộ-cụm gương ContractOutputs, chết ở A2; bảng
quyết-định status→(tone, hành động) là hàm thuần TDD — component chỉ render
kết quả.

**Tech Stack:** như hiện trạng, không dep mới. Better Auth client sẵn có
(`@/lib/auth-client`); oRPC client sẵn có (`@/lib/api/client`).

## Global Constraints (áp cho MỌI task)

- **Branch `feat/account-area`** từ `main`. Conventional Commits, message
  **tiếng Việt CÓ DẤU** (luật 12). ⚠️ SAU MỖI COMMIT chạy
  `git log -1 --format='%B'`; NẾU chứa "Co-Authored-By" THÌ
  `git commit --amend` sạch rồi kiểm lại; NẾU không thì xong.
- Comment/JSDoc tiếng Việt; copy user-facing TIẾNG ANH trong `@tourism/i18n`
  (khối `account*`); tokens-only; web import không đuôi.
- KHÔNG đụng API/contract/migrations (cụm này thuần web); KHÔNG
  `loading.tsx` (trang account là dynamic — luật soft-404); KHÔNG đổi
  visual các bề mặt đã duyệt ngoài 2 link user-menu.
- Trang account **dynamic per-user**: fetch server forward cookie +
  `cache: 'no-store'`, KHÔNG revalidate/tag — comment vì sao khác catalogue.
- TDD hàm thuần; jsdom ADR-0014; `pnpm gate:int` trước khai xong; luật 14
  sau mọi push. Cổng 3000/3001 sạch khi đo.
- **Sau Task 5 (mốc DỪNG A1) TUYỆT ĐỐI không tự tiến sang A2** — chờ user
  chốt visual.

---

### Task 1: Hạ tầng session — proxy + server-session + credentials

**Files:**
- Create: `apps/web/src/proxy.ts`
- Create: `apps/web/src/lib/api/session.ts` + `session.spec.ts`
- Modify: `apps/web/src/lib/api/client.ts` (thêm đường gọi authed)

**Interfaces (Produces — mọi task sau dùng nguyên văn):**
- `getServerSession(): Promise<SessionUser | null>` — server-only, React
  `cache()`; `SessionUser = { id: string; name: string; email: string;
  role: string; phone: string | null }` (đối chiếu response THẬT của
  `GET /api/auth/get-session` khi viết — spec §9 cảnh báo đừng tin type
  suy diễn; user `deletedAt != null` coi như null-session).
- `requireSession(redirectTo: string): Promise<SessionUser>` — gọi
  `getServerSession()`, null → `redirect('/login?redirect=' +
  encodeURIComponent(redirectTo))` (dùng `safeRedirect` khi ĐỌC lại param
  là việc của trang login — đã có từ cụm auth).
- Client oRPC: export thêm `apiAuthed` (hoặc option) — browser call với
  `credentials: 'include'`; server call authed: `withAuthHeaders(cookie)`
  context — forward cookie + `cache: 'no-store'`. Đọc kỹ khuôn
  `withNextOptions`/custom fetch hiện có rồi MỞ RỘNG cùng kiểu, đừng chế
  song song.

- [ ] **Step 1:** `proxy.ts` (Next 16 — tên file thay middleware):

```typescript
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Chặn sớm khu /account cho khách chưa đăng nhập (ADR-0017 §3 — port matcher
 * hẹp của Nexora). CHỈ kiểm cookie session TỒN TẠI — xác thực thật nằm ở
 * từng page (requireSession, defense-in-depth). Đây KHÔNG phải tầng bảo mật;
 * đừng thêm logic gì vào đây. `/tours/:slug/book` sẽ thêm ở cụm C.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('better-auth.session_token');
  if (!hasSession) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/account/:path*'] };
```

  (Tên cookie đối chiếu devtools/`.d.mts` BA lúc thi công — secure prefix
  `__Secure-` chỉ có trên https, dev là tên trần; nếu lệch thì theo thực đo,
  ghi report.)
- [ ] **Step 2 (TDD):** `session.spec.ts` — mock fetch: 200 có user → trả
  SessionUser đúng field; 200 user có `deletedAt` → null; 401/network → null
  (KHÔNG throw — trang tự redirect); gọi 2 lần trong cùng render chỉ 1 fetch
  (React cache — test qua spy). RED → GREEN.
- [ ] **Step 3:** mở rộng `client.ts` đường authed (browser credentials +
  server cookie-forward no-store). Typecheck + biome; commit
  `feat(web): hạ tầng session client — proxy matcher hẹp + getServerSession + đường gọi authed`.

---

### Task 2: Mock cụm + VM thuần (bảng quyết định status)

**Files:**
- Create: `apps/web/src/mocks/account.ts`
- Create: `apps/web/src/lib/booking-vm.ts` + `booking-vm.spec.ts`
- Create: `apps/web/src/lib/account-stats.ts` + `account-stats.spec.ts`

**Interfaces (Produces):**
- `mocks/account.ts`: `MOCK_BOOKINGS: Booking[]` (đủ 4 status: PENDING ·
  PAID ×3 biến thể cancellation (chưa-có/REQUESTED/DENIED) · CANCELLED ·
  REFUNDED + PARTIALLY_REFUNDED) · `MOCK_WISHLIST` · `MOCK_PROFILE`. Kiểu
  khai `satisfies`/annotation từ `@tourism/contract` (`Booking` — KHÔNG tự
  chế shape; spec §9: lệch shape là A2 đập visual).
- `bookingView(b: Booking, cancellation?: CancellationView): BookingView` —
  thuần; `BookingView = { tone: 'success'|'warning'|'muted'|'destructive';
  statusKey: string; actions: BookingAction[] }`;
  `type BookingAction = 'payNow' | 'cancelPending' | 'requestCancellation'
  | 'viewCancellationPending' | 'resubmitCancellation'`.
  Bảng: PENDING → warning + [payNow, cancelPending] · PAID → success +
  đúng MỘT trong 3 action cancellation theo trạng thái request · CANCELLED
  → muted + [] · REFUNDED/PARTIALLY_REFUNDED → destructive + [].
- `dashboardStats(bookings: Booking[], savedCount: number)` →
  `{ trips, upcoming, completed, saved }` + `nextTrip(bookings)` →
  `Booking | null` (PAID có `departureStartDate` tương lai gần nhất).

- [ ] **Step 1 (TDD):** spec cho `bookingView` phủ TRỌN bảng (6 ca status ×
  biến thể cancellation) + `dashboardStats`/`nextTrip` (rỗng · toàn quá khứ
  · phần tử biên hôm-nay). RED → GREEN.
- [ ] **Step 2:** mock đủ nhánh cho A1 (mỗi status ít nhất 1 booking, ngày
  tương lai/quá khứ trộn để dashboard có số).
- [ ] **Step 3:** test + typecheck + biome; commit
  `feat(web): VM booking thuần + mock nội bộ cụm account`.

---

### Task 3: Khung khu account + dashboard + saved (TĨNH)

**Files:**
- Create: `apps/web/src/app/(site)/account/layout.tsx` (nav nội khu — tabs/
  sidebar theo khuôn utility; đọc trang legal/LegalArticle làm mẫu giọng)
- Create: `apps/web/src/app/(site)/account/page.tsx` + components
  `account/account-dashboard.tsx`
- Create: `apps/web/src/app/(site)/account/saved/page.tsx` + components
  `account/saved-grid.tsx` (+spec jsdom)
- Modify: `apps/web/src/components/user-menu.tsx` (2 link `#top` →
  `/account` và `/account/bookings`) + cập nhật spec

**Consumes:** mock + VM Task 2 (page A1 đọc mock, KHÔNG gọi API).

- [ ] **Step 1:** layout + dashboard (stats 4 ô · thẻ nextTrip · 5 upcoming
  · 3 saved · empty tổng → CTA `/tours`) — tĩnh từ mock; card tour tái dùng
  component card catalogue sẵn có (đừng vẽ card mới).
- [ ] **Step 2:** saved grid + nút ✕ (A1: chỉ state cục bộ optimistic trên
  mock) + empty-state; jsdom: render đủ nhánh + user-menu 2 link mới.
- [ ] **Step 3:** test + typecheck + biome; commit
  `feat(web): khu account tĩnh — layout, dashboard, saved (pha A1)`.

---

### Task 4: Bookings list + detail + profile + security-redirect (TĨNH)

**Files:**
- Create: `.../account/bookings/page.tsx` + `account/booking-card.tsx`
- Create: `.../account/bookings/[code]/page.tsx` + `account/booking-actions.tsx`
  (+spec jsdom)
- Create: `.../account/profile/page.tsx` + `account/profile-form.tsx` ·
  `account/change-password-form.tsx` · `account/danger-zone.tsx` (+spec)
- Create: `.../account/security/page.tsx` (redirect vĩnh viễn → profile)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `account*` — chèn thuần)

**Consumes:** `bookingView` Task 2 — component CHỈ render `BookingView`,
không if/else status trong JSX ngoài map action→nút.

- [ ] **Step 1:** list (badge tone token-only + empty CTA + nút Load more
  hiện diện tĩnh) · detail đủ grid thông tin + `BookingActions` render đủ
  các nhánh từ mock (nút A1 là no-op có `aria-disabled` + tooltip "wire ở
  pha 2"? KHÔNG — nút thật, handler stub `console` cấm; để callback prop
  trống từ page, component nhận `onAction` — A2 truyền thật) + khối
  placeholder Review (chừa cụm B) + link `/cancellation-policy`.
- [ ] **Step 2:** profile hợp nhất: form tên/phone + đổi mật khẩu + connected
  accounts (đọc từ mock) + danger-zone (dialog confirm gõ `DELETE` mới bật
  nút) + avatar placeholder chữ-cái + email read-only kèm chú thích (PARK
  §4); security/page.tsx = `redirect('/account/profile')` + comment parity.
- [ ] **Step 3:** jsdom: BookingActions đủ nhánh theo `BookingView` ·
  danger-zone gate gõ-đúng-mới-bật · badge tone đúng map; test + typecheck
  + biome; commit `feat(web): bookings + profile + security tĩnh (pha A1 đủ 6 route)`.

---

### Task 5: MỐC DỪNG A1 — user chốt visual

- [ ] **Step 1:** `pnpm gate` nhanh xanh; mở dev server (cổng sạch, ghi
  PID); rà 6 route bằng mắt + curl 200; liệt kê cho controller: URL từng
  route + nhánh nào xem ở đâu (booking nào mang status nào trong mock).
- [ ] **Step 2:** DỪNG. Controller trình user review localhost. CHỜ chốt.
  User đòi chỉnh → vòng chỉnh trong pha A1 (không wire). Sau khi chốt:
  kill PID, cổng sạch, mới sang Task 6.

---

### Task 6 (A2): Wire ĐỌC — session thật + dashboard/bookings/saved từ API

**Files:**
- Create: `apps/web/src/lib/api/account.ts` · `bookings.ts` · `wishlist.ts`
  (+spec node cho phần map thuần nếu có)
- Modify: 6 page account (đọc thật) · Delete: `apps/web/src/mocks/account.ts`

**Consumes:** `requireSession`/`getServerSession` + đường authed (Task 1);
procedure: `bookings.mine` (`GET /api/bookings`, query `page/limit≤50/
status?`) · `bookings.byCode` (`BOOKING_NOT_FOUND` → `notFound()`) ·
`wishlist.list` · `GET /api/account/me`.

- [ ] **Step 1:** mỗi page: `const user = await requireSession('<path>')` +
  fetch song song (`Promise.all`) → VM. Detail: byCode NOT_FOUND → 404
  thật. List: Load more = server component đọc `?page=` (không client
  state — đơn giản, giữ dynamic).
- [ ] **Step 2:** khai tử `mocks/account.ts` — grep `mocks/account` = 0 hit;
  jsdom chuyển mock sang `@/lib/api/*`. Test + typecheck + biome; commit
  `feat(web): khu account đọc API thật — khai tử mock cụm (pha A2)`.

---

### Task 7 (A2): Wire HÀNH ĐỘNG — pay/cancel/request/profile/danger

**Files:**
- Modify: `account/booking-actions.tsx` · `saved-grid.tsx` · `profile-form.tsx`
  · `change-password-form.tsx` · `danger-zone.tsx` (+spec jsdom cập nhật)

**Consumes:** client authed (Task 1 — browser `credentials: 'include'`):
`bookings.checkout` → redirect `checkoutUrl` · `POST .../cancel-pending` ·
`POST .../cancel` (request cancellation, body lý do optional) ·
`wishlist.set` (bỏ lưu — optimistic + rollback + toast lỗi) · Better Auth
`authClient.updateUser({ name, phone })` + `changePassword({...})` (XÁC
MINH tên method/field qua `.d.mts` — bài học `'max'`) · `DELETE
/api/account` → `authClient.signOut()` → `router.push('/')` + toast.

- [ ] **Step 1 (jsdom RED trước):** mỗi hành động một test — gọi đúng
  procedure/payload (mock module), thành công → `router.refresh()`/redirect
  đúng đích, lỗi → message inline + KHÔNG mất state; 401 giữa chừng →
  message + link `/login?redirect=` (spec §5 — không auto-signout).
- [ ] **Step 2:** wire thật theo khuôn try/catch + `mapAuthError`/
  `classifySubmitError` sẵn có (bài học pending-kẹt cụm auth: MỌI await đều
  try/catch, `finally` nhả pending). Test + typecheck + biome; commit
  `feat(web): hành động account thật — pay/cancel/request/profile/xoá tài khoản`.

---

### Task 8: Nghiệm thu (spec §7) + gate:int + CI + chốt

- [ ] **Step 1:** production build (API sống, cổng sạch, `rm -rf .next`,
  kill theo PID CỔNG — bài học pkill tự sát + server-cũ-ghi-đè 04/08). Đo
  DÁN NGUYÊN VĂN đủ §7: vòng đời thật (đăng nhập → dashboard số khớp SQL;
  PENDING: Pay now ra checkoutUrl thật + cancel-pending đổi status; PAID
  (dựng qua SQL/smoke-flow): request cancellation → row REQUESTED + UI đổi;
  xoá tài khoản → `deletedAt` set + 401 sau đó) · chưa đăng nhập → redirect
  (đo cả proxy lẫn page — page đo bằng curl thẳng có cookie rác) ·
  `x-nextjs-cache` trang public vẫn HIT · `/account/bookings/BK-KHONGCO`
  → 404 · build production KHÔNG cần session (log build sạch lỗi fetch).
- [ ] **Step 2:** dọn (SQL revert dữ liệu mồi — dán số row; PID; cổng 000);
  `pnpm gate:int` trọn; push branch → CI xanh (luật 14) → DỪNG chờ user
  quyết merge → docs sweep luật 13 (CHANGELOG nhớ luật dấu `+` — grep
  TRƯỚC add; ADR-0016 mock-list: `mocks/account.ts` sống-rồi-chết trong
  cụm; ADR-0017 tick phần proxy/credentials đã thi hành; README).
