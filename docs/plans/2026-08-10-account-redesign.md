# Redesign khu account — Implementation Plan

**Goal:** Thay lớp trình bày của 5 màn `/account/*` theo mockup đã chốt, đồng
thời đóng ba khoản nợ cùng lúc: A1 (thiết kế lại), A2 (ô lý do huỷ), A3 (tương
phản dark). Giữ NGUYÊN toàn bộ tầng gọi API và hành động đã wire.

**Architecture:** Thay da, không xây lại — xem [spec §0](../specs/2026-08-08-account-redesign-design.md)
cho bốn thứ tuyệt đối không được gỡ. Tách lớp gọi API + phân loại lỗi ra hook
riêng TRƯỚC khi đụng markup, để 53 test hiện có bám hook thay vì bám DOM. Token
đi theo [ADR-0019](../adr/0019-color-token-roles.md).

**Tech Stack:** Next.js 16.3.0 · React 19.2.4 · Tailwind v4 + `@tourism/tokens`
(Style Dictionary + culori để đo) · Base UI qua `@tourism/ui` · Vitest 4.1.10 +
jsdom.

## Global Constraints

Áp cho MỌI task:

- **Comment code tiếng Việt** (luật #8); identifier tiếng Anh.
- **Copy user-facing tiếng Anh**, gom ở `@tourism/i18n` (luật #7) — kể cả
  `aria-label`. Khu account đang còn `aria-label="Account"` hardcode, vá luôn.
- **Tokens-only, KHÔNG hex** (luật #6).
- **Commit Conventional, message tiếng Việt CÓ DẤU**, không AI attribution
  (luật #12). Sau mỗi commit kiểm `git log -1 --format=%B` xem có trailer lọt vào.
- **`noUncheckedIndexedAccess` đang BẬT** — `arr[0]` có kiểu `T | undefined`.
- **Nhánh:** `feat/account-redesign` (đã tạo, đã rebase lên main).
- **`apps/web` KHÔNG bật vitest globals** — mọi spec phải
  `import { describe, expect, it } from 'vitest'`. Khác `apps/api`, đã dính một lần.
- **Rà [docs/skills.md](../skills.md)** trước mỗi task (luật #9).
- **`pnpm gate` cần CẢ Postgres LẪN API sống** — 4 file `*.e2e.spec.ts` boot
  AppModule, và build web fetch `localhost:3001`. Không phải chỉ Postgres.

## Tasks

### Task 1 — Chuẩn bị test-safety (KHÔNG đụng markup)

- [ ] ~~Tách lớp gọi API + `classifyActionError` của 5 component client ra hook
      riêng~~ — **KHÔNG làm.** Mục đích của nó là để spec bám hook thay vì bám
      DOM, nhưng markup của cả 5 màn đều đổi thật nên spec phải viết lại bằng
      mọi giá. Năm cái hook chỉ thêm một tầng gián tiếp mà không cứu được test
      nào. Hai việc còn lại của Task 1 (gom khối lỗi, dời `TONE_CLASS`) mới là
      thứ thật sự gỡ được ràng buộc chéo.
- [x] Gom khối lỗi `sessionExpired` + link `/login?redirect=` đang chép NGUYÊN
      4 lần thành một component dùng chung.
- [x] Dời `TONE_CLASS` ra khỏi `account-dashboard.tsx` — hiện `booking-card.tsx`
      và trang detail đang import ngược từ component dashboard.
- [x] `pnpm test --filter=@tourism/web` phải XANH mà không sửa spec nào: task
      này thuần refactor, đổi hành vi là sai.

### Task 2 — Token theo ADR-0019 (site-wide, KHÔNG riêng account)

- [x] Thêm token vai CHỮ cho dark (`L 0.76`); light giữ `0.494`.
- [x] `ring`/`sidebar-ring` dark `0.563 → 0.60`; `sidebar-primary`, `chart-1`
      về đúng vai (đây là trôi từ `cf8f821`, bốn token bị bỏ quên).
- [x] `input` nâng đạt 3:1 (dark `L ≥ 0.58`, light `≈ 0.66`); **`border` GIỮ
      NGUYÊN** — nó là đường phân cách, không thuộc WCAG 1.4.11.
- [x] Nút primary ở dark nhận viền hairline mang ranh giới 3:1.
- [x] Sửa comment sai số ở `region-hero.tsx:163` (ghi 4.11, đo thật 4.72).
- [x] Đo lại bằng culori, mọi cặp trong ADR-0019 đạt ngưỡng đã ghi.
- [x] `pnpm gate` để bắt chỗ vỡ NGOÀI khu account.

### Task 3 — `/account` dashboard

- [x] Đảo trục: thẻ chuyến kế tiếp lifted lên đầu → 2 ô số (thay 4) → "Recent
      bookings" dạng sheet. Bỏ khối 3 tour đã lưu.
- [x] Hàm thuần MỚI chọn "recent bookings" — có CẢ CANCELLED, khác
      `upcomingBookings` hiện tại (chỉ PENDING/PAID, chỉ tương lai). TDD.
- [x] Đồng hồ hạn PENDING dùng `pendingExpiry()` đã có từ cụm C.

### Task 4 — `/account/bookings`

- [x] Ba nhóm thời gian (On the road now / Upcoming / Past) trên sheet hairline.
- [x] Hàm thuần chia nhóm — TDD.

### Task 5 — `/account/bookings/[code]` + nợ A2

- [x] Ô nhập lý do huỷ, **chỉ ở nhánh PAID**. Tuyệt đối không gắn vào dialog
      `cancelPending` (input chỉ `{code}`, không lý do, không admin).
- [x] Xoá hằng `DEFAULT_CANCELLATION_REASON` — chuỗi đó đang được email NGƯỢC
      cho chính khách.
- [x] Copy lấy từ khối i18n mồ côi `messages.booking.detail`; sửa `reasonLabel`
      từ "(optional)" thành bắt buộc (user chốt 08/08). Bộ đếm trần **1000**.
- [x] Vá `classifyActionError`: 409 `ALREADY_REQUESTED` và 422 `NOT_CANCELLABLE`
      đang rơi vào generic dù i18n đã có copy riêng.
- [x] Xoá nhánh JSX dùng `deniedNote` — prop đó LUÔN null, là code chết.
- [ ] ~~Dựng slot trống cho form review~~ — gộp vào Task 8, xem mục sai lệch.

### Task 6 — `/account/profile`

- [x] Summary-list đọc-trước kiểu GOV.UK: mỗi dòng có link "Change", chỉ dòng
      đang sửa nở thành form.
- [x] GIỮ field "Current password" — bắt buộc của Better Auth.
- [x] Nếu thêm thuộc tính validate native thì PHẢI thêm `noValidate` (bug đã
      dính ở form đặt chỗ, `4959455`).
- [x] Mockup bỏ avatar — theo mockup.

### Task 7 — `/account/saved`

- [x] Bỏ hai field không có dữ liệu (category, giá gạch) — spec §2. **Làm
      mạnh hơn:** gỡ hẳn nguồn bịa, xem mục sai lệch.
- [x] Giữ `item.unavailable` đi qua `UnavailableCard`.
- [x] Vá `SavedGrid` nuốt trọn lỗi trong `catch {}` — thêm nhánh
      `sessionExpired` cho đồng bộ với 4 component còn lại.

### Task 8 — Cụm B nửa 2: form review

- [x] Field additive cho "booking này đã review chưa" — hiện KHÔNG có cách nào
      biết ngoài POST rồi ăn 409, tức khách gõ xong cả bài mới biết.
- [x] Form review trên trang chi tiết booking, chỉ hiện khi đủ điều kiện.

### Task 9 — Nghiệm thu + docs sweep

- [x] `pnpm gate:int` xanh (luật #11).
- [x] Đo lại tương phản, đối chiếu ADR-0019.
- [x] Đi tay 5 màn ở CẢ hai chế độ sáng/tối.
- [x] Xin huỷ một booking PAID thật, xác nhận lý do KHÁCH GÕ xuất hiện trong
      `cancellation_requests.reason` và trong email — không còn chuỗi
      'Requested via account portal.'
- [x] Entry CHANGELOG + cập nhật spec/plan chỗ nào lệch code + bản đồ docs.

## Sai lệch có chủ đích so với plan

**Task 5 KHÔNG dựng slot trống cho form review.** Plan ghi "dựng slot trống
đúng kích thước cho form review (Task 8)", nhưng dựng một chỗ trống rồi thay
ngay ở task kế là làm hai lần cùng một chỗ. Gộp vào Task 8.

**Task 7 làm nhiều hơn plan.** Plan chỉ ghi "bỏ hai field không có dữ liệu",
nhưng đọc code mới thấy `TourCard` vốn KHÔNG render `category`/`maxGroupSize`/
`isFeatured` — nên phần bịa chưa bao giờ lên màn hình, chỉ nằm chờ. Vì Task 3
đã bỏ khối "3 tour đã lưu" khỏi dashboard, `saved-grid` thành consumer cuối
cùng và viết card riêng trở nên rẻ — gỡ được hẳn nguồn bịa thay vì giấu nó,
xoá luôn `wishlist-vm` và spec.

**Task 9 phát sinh một bản vá ngoài phạm vi.** Ảnh nghiệm thu chế độ SÁNG lộ
ra navbar tàng hình trên 8 trang không có hero (`/account/*`, `/checkout/*`).
Lỗi có sẵn, không do redesign, nhưng nó làm hỏng đúng tiêu chí nghiệm thu nên
vá luôn — xem `b7ccf83`.

## Ba thứ chỉ ẢNH CHỤP bắt được, test thì không

1. **"Trips booked 0"** đứng ngay trên ba dòng booking PENDING — đọc thành mâu
   thuẫn. Bản bốn ô cũ giấu được vì có "Upcoming 3" làm dịu. Đổi nhãn thành
   "Trips paid".
2. **Nhãn trường hiện hai lần và hai nút Cancel** ở trang hồ sơ, do form nở ra
   xếp chồng dưới dòng thay vì thay thế giá trị.
3. **Navbar tàng hình ở chế độ sáng** — mục trên.

Cả ba đều có test xanh tại thời điểm đó. Test kiểm hành vi; bố cục và tương
phản thì phải nhìn.
