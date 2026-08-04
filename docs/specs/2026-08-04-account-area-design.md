# Spec — Cụm A bước 8–10: hạ tầng session client + khu Account (2026-08-04)

- **Trạng thái:** Approved 04/08 (khung 3-cụm A/B/C user duyệt cùng ngày —
  account đi static-first TRONG repo, đủ 6 route parity; avatar + đổi email
  PARK; Booking đi đường Claude Design bằng prompt trong `docs/design/`)
- **Nền:** [ADR-0017](../adr/0017-web-session-better-auth.md) (cookie thẳng,
  `proxy.ts` matcher hẹp, defense-in-depth) · khảo sát sâu Nexora 04/08 (6
  trang account, badge/hành-động theo status, cancellation inline) ·
  [booking-states](../conventions/booking-states.md) (ngữ nghĩa terminal).
- **Branch:** `feat/account-area`.

## 1. Phạm vi — HAI PHA trong một cụm, có MỐC DỪNG

| Pha | Nội dung | Gate |
| --- | --- | --- |
| A1 — tĩnh | Hạ tầng session + 6 route account dựng TĨNH (mock nội bộ cụm) | **DỪNG: user review localhost, chốt visual** |
| A2 — wire | Nối API thật từng trang, khai tử mock cụm | nghiệm thu §7 + final review |

Route (parity 6/6 Nexora): `/account` (dashboard) · `/account/bookings` ·
`/account/bookings/[code]` · `/account/profile` (settings hợp nhất) ·
`/account/security` (**redirect 308 → profile** — đúng mẫu Nexora, parity đủ
route không đủ trang) · `/account/saved` (khung + đọc wishlist; nút tim trên
card catalogue là việc CỤM B).

## 2. Hạ tầng session client (nửa còn lại của ADR-0017)

- `apps/web/src/proxy.ts`: matcher **chỉ** `['/account/:path*']` (route
  `/tours/:slug/book` thêm ở cụm C — comment chừa chỗ); kiểm cookie session
  (đọc `better-auth.session_token` TỒN TẠI là đủ ở tầng proxy — xác thực
  thật ở page) → thiếu thì redirect `/login?redirect=<path>` qua
  `safeRedirect`. KHÔNG chạm trang public.
- `apps/web/src/lib/api/session.ts`: server đọc session — fetch
  `GET {api}/api/auth/get-session` forward `headers: { cookie }`, bọc React
  `cache()`, trả `SessionUser | null`; mỗi page account gọi + `redirect`
  nếu null (defense-in-depth — Nexora làm 2 lớp, giữ).
- `lib/api/client.ts`: nhóm procedure cần auth gọi từ browser thêm
  `credentials: 'include'` (ADR-0017 Hệ quả); đường server-fetch cho trang
  account forward cookie qua context (mở rộng `withNextOptions` — KHÔNG
  cache/tag cho data per-user: `cache: 'no-store'`, comment vì sao khác
  catalogue).
- Trang account là **dynamic** (per-user) — đo đúng khuôn
  [soft-404](../conventions/soft-404-loading-tsx.md): KHÔNG `loading.tsx`.

## 3. Sáu route — nội dung từng trang (visual chốt ở pha A1)

- **`/account` dashboard:** stats (trips/upcoming/completed/saved — đếm từ
  bookings+wishlist), thẻ "chuyến kế tiếp" (booking PAID có departure gần
  nhất), 5 booking sắp tới, 3 tour đã lưu. Empty tổng → CTA `/tours`.
- **`/account/bookings`:** list card mới-nhất-trước (`GET /api/bookings` —
  procedure `bookings.mine`; contract CÓ pagination thật `page/pageSize`,
  hơn Nexora vốn cap-50-không-trang — UI làm nút "Load more" đơn giản);
  badge tone theo status: PAID=success · PENDING=warning ·
  CANCELLED=muted · REFUNDED/PARTIALLY_REFUNDED=destructive (token-only);
  empty → CTA `/tours`.
- **`/account/bookings/[code]`:** grid thông tin (tour + departure ·
  travellers · mã BK-… · tổng tiền · provider · contact · specialRequests
  nếu có); mã lạ/không phải của mình → 404 thật. Hành động theo status
  (khớp máy trạng thái API — ĐỌC KỸ hai đường khác nhau):
  - PENDING: **Pay now** (`bookings.checkout` → redirect checkoutUrl) +
    **Cancel** (confirm dialog → `POST /api/bookings/{code}/cancel-pending`
    — BK-2 tự hủy, không refund).
  - PAID: khối **Request cancellation** — form lý do (textarea, optional)
    → `POST /api/bookings/{code}/cancel` (W4 tạo CancellationRequest);
    nếu request `REQUESTED` → text "pending review"; `DENIED` → lý do +
    nút gửi lại. Link `/cancellation-policy`.
  - Terminal khác: read-only + note số tiền đã hoàn nếu có (đọc từ API).
  - Khu Review: **chừa chỗ** (placeholder khối, cụm B gắn form).
- **`/account/profile`:** hợp nhất — form tên/phone (ghi qua Better Auth
  client `updateUser` — phone là additionalField `input: true`; XÁC MINH
  method qua `.d.mts` lúc thi công) · đổi mật khẩu (`changePassword` BA) ·
  Connected accounts (list provider từ session/BA — read-only) ·
  **Danger zone**: xoá tài khoản (confirm gõ chữ → `DELETE /api/account`
  — tombstone `deletedAt` sẵn có → `signOut()` → về `/` + toast). Avatar:
  khối placeholder tĩnh (PARK — §4).
- **`/account/security`:** route tồn tại, redirect vĩnh viễn về
  `/account/profile` (parity đường dẫn, một trang settings).
- **`/account/saved`:** grid card tour đã lưu (`GET /api/wishlist` —
  `wishlist.list`), nút ✕ bỏ lưu (optimistic + rollback — dùng
  `wishlist.set` idempotent), empty → CTA `/tours`.

## 4. PARK có hồ sơ (lý do cố ý bỏ — luật parity)

- **Avatar upload:** Nexora dùng signed-upload Cloudinary; API v2 chỉ có
  media ĐỌC (ADR-0005) — thêm bề mặt ghi là ADR/contract mới sát freeze,
  không đáng cho capstone. UI để avatar chữ-cái-đầu tĩnh; nợ ghi CHANGELOG.
- **Đổi email:** Better Auth `user.changeEmail` đang tắt mặc định; flow
  verify 2 chiều. PARK, UI hiện email read-only kèm chú thích.

## 5. Kỹ thuật chung

- Pha A1 dùng **mock nội bộ cụm** `apps/web/src/mocks/account.ts` (đủ 4
  status booking + cancellationRequest 3 trạng thái để duyệt visual mọi
  nhánh) — **khai tử ngay trong pha A2** (mock chết trong cùng cụm, không
  sống qua merge; cập nhật ADR-0016 mock-list ở docs sweep).
- VM + fetch: `lib/api/account.ts` (me/delete) · `lib/api/bookings.ts`
  (mine/byCode/checkout/cancelPending/requestCancel — map DTO → VM cạnh
  fetch như nếp `tours.ts`) · `lib/api/wishlist.ts`. Copy vào i18n khối
  `account*` (tiếng Anh). Toast chỉ cho kết quả thao tác; lỗi field inline.
- Layout: `(account)` route group riêng có sidebar/tabs nội khu (khuôn
  utility — TicketCard/LegalArticle làm mẫu giọng; KHÔNG sáng tạo hero mới);
  navbar user-menu nối 2 link `My account`/`My bookings` thật (bỏ `#top`).
- Lỗi 401 giữa chừng (session hết hạn khi đang thao tác): message form +
  link `/login?redirect=` — KHÔNG auto-signout, KHÔNG retry (đơn giản hơn
  Nexora nhờ không có lớp sync-user).

## 6. Test

- Thuần (TDD): map VM booking (status→tone/hành-động — bảng quyết định
  là hàm thuần) · dựng stats dashboard từ list · validate form lý do.
- jsdom: BookingActions per-status (4 nhánh) · danger-zone confirm gate ·
  saved-grid optimistic rollback · profile form submit đúng payload
  (mock `@/lib/auth-client` + `@/lib/api/*`).
- Int: đã có sẵn phía API (bookings/cancellations/wishlist từ P2-P3a) —
  cụm này KHÔNG đụng API; chỉ thêm test khi lòi thiếu sót thật.

## 7. Nghiệm thu

1. **Gate A1:** đủ 6 route trên localhost với mock — user duyệt visual
   (mọi nhánh status nhìn được bằng mock); KHÔNG wire trước khi chốt.
2. Sau A2 (production build + API + DB thật): vòng đời thật — đăng nhập
   → dashboard số đúng DB; booking PENDING thật: Pay now ra checkoutUrl,
   Cancel-pending đổi status; booking PAID (mượn từ smoke-flow hoặc SQL):
   request cancellation → row `cancellation_requests` REQUESTED, UI đổi;
   xoá tài khoản → `deletedAt` set, session chết, guard API chặn (401).
3. `/account/*` chưa đăng nhập → redirect `/login?redirect=` (đo cả proxy
   lẫn tầng page bằng cách tắt proxy thử); trang public giữ static/ISR
   (`x-nextjs-cache` HIT như cũ — proxy không chạm).
4. Soft-404: `/account/bookings/BK-KHONGCO` → 404 thật.
5. `pnpm gate:int` trọn + CI branch xanh trước merge (luật 14).

## 8. Ngoài phạm vi

- Nút tim wishlist trên card catalogue + form review (CỤM B).
- Booking form + checkout success/cancel (CỤM C — prompt Claude Design
  giao ngay sau spec này được duyệt).
- Phân trang bookings >50 (nợ chung với Nexora — ghi CHANGELOG) ·
  avatar/đổi email (§4) · print/PDF.

## 9. Rủi ro

- **Session shape từ `get-session`** phải khớp `SessionUser` phía API
  (additionalFields role/phone/deletedAt) — đối chiếu response THẬT trước
  khi viết VM, đừng tin type suy diễn.
- Proxy đọc cookie tồn tại (không verify chữ ký) — chấp nhận: page xác
  thực thật; ghi comment để không ai tưởng proxy là tầng bảo mật.
- Trang account dynamic + fetch per-request — build không prerender chúng
  (đúng chủ đích), nhưng PHẢI kiểm build production không cần session vẫn
  build được (page động không chạy fetch lúc build).
- Mock A1 phải gương ĐÚNG shape contract (khuôn `MockX = ContractOutputs`
  như các cụm trước) — lệch shape là pha A2 phải đập visual đã chốt.
