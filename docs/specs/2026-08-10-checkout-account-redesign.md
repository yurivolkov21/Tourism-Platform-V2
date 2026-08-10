# Spec — Redesign Checkout (hướng B) + khu Account (hướng A)

- **Ngày:** 2026-08-10 · **Trạng thái:** chờ user duyệt
- **Nguồn quyết định:** demo vòng 1 (artifact "Redesign vòng 1 — Checkout & Account"),
  user chốt: *checkout theo B, account theo A*; review cuối trên giao diện thật.
- **Khảo sát nền:** 2 báo cáo research (checkout: GetYourGuide/Klook/Airbnb/Viator/
  Booking.com · account: Airbnb/Booking/GYG/Klook/Shopify/Linear/Stripe) — pattern
  "chuẩn ngành" trích ở mục 2.

## 1. Scope

**Đụng:** `/tours/[slug]/book` · `/checkout/success` · `/checkout/cancel` ·
toàn khu `/account/**` (6 route hiện có). **KHÔNG đụng:** mọi trang public khác,
trang auth, tokens màu/font (nhận diện Wuling giữ nguyên — các trang public không
đổi nên hai khu này phải hoà cùng hệ hiện có).

Chỉ thay **tầng trình bày**. Tầng logic giữ nguyên và đã có test phủ:
`lib/api/*` (session, account, bookings, wishlist), `booking-vm.ts`,
`account-stats.ts`, contract schemas, flow thanh toán capture-on-approved.
Wiring nào buộc phải sửa nhẹ (đổi props component) thì sửa kèm test tương ứng.

## 2. Chuẩn ngành cố định (áp cho mọi trang trong scope)

1. Order summary có ảnh tour + breakdown giá đầy đủ TRƯỚC nút trả tiền, ghi
   "taxes included".
2. Trấn an hủy-miễn-phí kèm mốc ngày giờ cụ thể, lặp cạnh CTA trả tiền.
3. Confirmation kiểu voucher (mã đặt chỗ nổi bật + next steps), không "cảm ơn" suông.
4. Booking hiển thị như *chuyến đi* (ảnh, đếm ngược), không phải record đơn hàng.
5. Hành động hủy bị giáng cấp thị giác (text link + policy tại chỗ); không danger-zone.
6. Tiết chế màu brand vùng thanh toán: teal chỉ dồn cho CTA.
7. KHÔNG dark-pattern: không fake khan hiếm, không đồng hồ giả (bài học EU sờ gáy
   Booking.com). Chỉ nói "đang giữ chỗ" khi session provider thật sự tồn tại.

## 3. Checkout — hướng B "Quảng trường" (GYG/Klook)

### 3.1 `/tours/[slug]/book`

- **Step indicator 2 bước**: `① Trip details → ② Payment` (bước 2 diễn ra ở
  provider — Stripe/PayPal hosted). Không phải wizard nhiều trang; chỉ là bản đồ
  hành trình.
- **Lưới 2 cột 7/5** (mobile: summary thu gọn lên đầu, form dưới):
  - **Cột trái — các card viền rõ**: (a) "Lead traveler" — name/email prefill từ
    session; (b) "Trip details" — departure picker + stepper adults/children như
    logic hiện có, khoác skin card; (c) "Payment method" — 2 tile `Card (Stripe)`
    / `PayPal` (bỏ tile "Pay later" của demo — backend không có).
  - **Cột phải — summary sticky**: ảnh tour thật (đã có trong API tour detail),
    title, meta (duration · destination · rating nếu có), badge policy
    (`Free cancellation`, `Instant confirmation` — CHỈ hiện khi phản ánh đúng
    policy thật của hệ thống), breakdown `$X × n adults / $Y × n children`,
    total đậm + "taxes included", CTA `Continue to payment · $Z`, hàng trust
    `Stripe & PayPal · SSL encrypted` dưới CTA.
- **Cắt khỏi demo B** (đồ giả): ô promo code, "reserve now pay later", đồng hồ
  giữ chỗ. KHÔNG thêm lại khi thi công.

### 3.2 `/checkout/success` — voucher-first

Mã booking cỡ lớn (IBM Plex Mono) + nút copy · tóm tắt tour (ảnh nhỏ, ngày,
khách, tổng đã trả) · khối "What happens next" (email confirmation đã gửi /
xem chi tiết trong Trips) · CTA chính `View in Trips`, phụ `Browse more tours`.

### 3.3 `/checkout/cancel`

Trấn an "chưa mất gì, chưa bị trừ tiền" · thông điệp giữ chỗ TRUNG THỰC: session
Stripe còn hạn trong 60′ kể từ lúc tạo — copy dạng "your reservation is held for
up to an hour" (không đếm ngược giả) · CTA `Return to checkout` + `Back to tour`.

## 4. Khu Account — hướng A "Tĩnh viện" (Airbnb)

Ngôn ngữ chung: heading serif Literata, hierarchy bằng cỡ chữ + divider mảnh
(`border-border/55`), KHÔNG card lồng card; teal chỉ ở link nhấn/CTA.

- **`/account`**: bỏ trang hub (4 mục < ngưỡng 6 của khảo sát) → redirect
  `/account/bookings`. Nav khu account thành thanh ngang nhẹ 4 mục
  `Trips · Saved · Profile · Security` (mobile: giữ pattern nav hiện có).
  Component `account-hub.tsx` + `account-stats.ts` ngừng dùng ở đây — gỡ nếu
  không còn ai import (kèm gỡ test tương ứng), KHÔNG để mã chết.

  > **AMENDED (Task 5, 2026-08-10):** nav khu account thực ra **3 mục**
  > (`Trips · Saved · Profile`), không phải 4 như câu trên — vòng 10/08 TRƯỚC
  > câu này đã nhập `/account/security` vào `/account/profile` bằng redirect
  > 308 rồi ("đủ route không đủ tab": route còn sống cho link/bookmark cũ,
  > nhưng không có tab riêng). Quyết định đó GIỮ NGUYÊN ở Task 5: password +
  > delete account nằm trong Profile, khớp pattern Airbnb "rows một trang"
  > thay vì tách trang Security riêng.
- **`/account/bookings` → "Trips"**: section `Upcoming` — card lớn: ảnh tour,
  eyebrow đếm ngược "In N days", title, ngày + khách, mã mono, hàng action link
  (`View voucher` → detail · `Contact us`), chú thích policy nhỏ. Section
  `Where you've been` — dòng nhỏ ảnh 56px, mờ nhẹ, link `Leave a review`
  (hook cho cụm B review form); booking hủy = dòng chữ xám "Cancelled · refunded"
  theo `cancellationStatus`, không badge đỏ. Giữ Load-more hiện có (nợ cap 50 giữ
  nguyên trong sổ).
- **`/account/bookings/[code]`**: khối đầu = ảnh + ngày + khách + mã mono + trạng
  thái (mapping `bookingView` giữ nguyên); khối payment (đã trả/chờ — action
  `Pay now` nếu PENDING); section "Cancellation policy" nêu điều kiện; **hành
  động hủy = text link cuối trang** mở flow hiện có, bổ sung **textarea lý do
  hủy** (trả nợ CHANGELOG 06/08 — field `reason` contract đã có).
- **`/account/saved`**: lưới ảnh 3 cột (2 tablet, 1 mobile), card = ảnh + tên +
  giá; empty state dạy hành vi ("Tap the heart on any tour…") + CTA Browse tours.
- **`/account/profile`**: pattern **hàng-nở-inline**: mỗi trường một dòng
  `Label — giá trị — Edit`, bấm Edit nở thành form ngay tại dòng (name, email
  read-only nếu hệ chưa cho đổi). Trang đọc như bản tóm tắt, không phải form dài.
- **`/account/security`**: cùng pattern dòng (Password — `••••` — Change nở
  inline); **xóa tài khoản = text link `destructive-emphasis` cuối trang** + dialog
  xác nhận hiện có. Bỏ hộp danger-zone.

## 5. Hệ quả kỹ thuật

- **Tokens-only giữ nguyên**: không hex mới; badge nền nhạt dùng opacity modifier
  trên token sẵn (`bg-success/15`, `bg-warning/20`…), KHÔNG thêm token mới.
- **Nợ contrast primary dark 2.91 — đóng bằng giải pháp thay thế**: đã đo (ADR-0019
  + comment tokens) là không thể đạt đồng thời 3:1 nền và 4.5:1 chữ; thi công thêm
  `border` 1px (token `border`) cho nút primary ở dark để tăng phân định không-màu.
  Ghi kết luận vào hồ sơ nợ (comment tokens + CHANGELOG) — nợ ĐÓNG.
- **English-only copy** sản phẩm, tập trung `@tourism/i18n` (khối messages mới:
  `checkoutB`, `accountA` — đặt tên theo trang, không theo hướng). Comment code
  tiếng Việt.
- **Không đụng route handler/API**; redirect `/account` làm ở `page.tsx`
  (`redirect()`), giữ matcher proxy nguyên trạng.
- **Test**: component test theo nếp hiện có (jsdom) cho các component thay da có
  logic hiển thị (countdown, mapping trạng thái → dòng chữ, nở-inline); VM/lib
  không đổi thì test giữ nguyên phải tiếp tục xanh. `pnpm gate:int` trước khi khai
  xong (luật 11).
- **Quy trình thi công**: branch riêng theo luật 1; KHÔNG build `apps/web` khi dev
  server của user đang chạy — dùng git worktree (bài học T7); screenshot tự kiểm
  bằng `npx playwright screenshot`.

## 6. Ngoài scope (giữ nguyên sổ nợ)

Wishlist tim trên card + review form (cụm B đã hẹn) · refundedTotal (cụm C) ·
Load-more cap 50 · connected-accounts · user-menu labels · PayPal checkout UI
phía provider.
