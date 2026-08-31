# Spec P4b — CRUD kit + 3 vùng ăn sẵn (bookings · cancellations · reviews-mod)

31/08/2026 · tiếp nối ADR-0026 (app admin riêng) và vòng shell dashboard-01
(CHANGELOG 31/08). Đầu vào: [khảo sát parity 20/08](../analysis/2026-08-20-admin-parity-nexora.md).

## 1. Mục tiêu & phạm vi

Ba vùng admin ĐẦU TIÊN có dữ liệu thật, dựng trên API **đã sống sẵn** — P4b
không thêm endpoint nào. Bảy endpoint trong `contract.ts` §admin:

| Vùng | Endpoint | Ghi chú |
| --- | --- | --- |
| Bookings | `admin.bookings.list` · `byCode` · `refund` | list có filter status/search + phân trang; refund là money-path (ledger ADR-0009, 5 mã lỗi 422/502) |
| Cancellations | `admin.cancellations.list` · `decide` | decide một cửa approve/deny; approve = refund + CANCELLED + nhả ghế atomic |
| Reviews | `admin.reviews.list` · `moderate` | moderate = transaction 4-trong-1 (flip + audit + recompute rating + email) |

Ngoài phạm vi P4b: mọi vùng cần endpoint mới (enquiries, subscribers, outbox,
payment-events, dashboard-stats, catalog CRUD, media, users) — thuộc P4c–P4f
theo thứ tự ADR-0026.

## 2. Quyết định thiết kế

1. **Kit mọc từ consumer đầu tiên, không dựng abstraction trước.** Bài học kit
   19 component của Nexora cũ: nó thành hình QUA các vùng thật. F1 (bookings)
   vừa dựng vùng vừa tách phần dùng-lại-được; F3/F4 tiêu thụ và ép kit tổng
   quát hoá. Xương có sẵn: `apps/admin/src/components/data-table.tsx`
   (TanStack v9 + dnd-kit, đã dọn demo ở vòng shell — cột
   Code/Tour/Status/Guests/Amount/Customer đặt sẵn cho bookings).
   *Nợ ghi nhận sau F1 (review 31/08):* kit `components/kit/` mới có bảng
   bookings tiêu thụ; bảng demo dashboard (`data-table.tsx`, trang `/`) vẫn
   giữ bản copy pagination/copy hardcode riêng — dọn khi P4d thay nó bằng
   bảng recent-bookings thật (đằng nào cũng viết lại trên kit lúc đó).
2. **List page = server component, trạng thái trên URL.** `searchParams`
   (page/status/q) → fetch oRPC server-side → truyền data xuống table client.
   TanStack chạy `manualPagination` — phân trang/filter đổi URL (router.push),
   KHÔNG fetch từ client. Được gì: cookie admin forward sẵn nếp `session.ts`,
   không cần state client phức tạp, URL share được. Drag-row của kit TẮT ở
   vùng thật (không có nghĩa sắp xếp).
3. **Client oRPC cho admin port từ web** (`apps/web/src/lib/api/client.ts` —
   OpenAPILink + `JsonifiedClient`), rút còn phần admin cần: gọi server-side
   với cookie forward (nếp `apps/admin/src/lib/api/session.ts`), KHÔNG cần
   ISR/cache-tag (admin luôn dữ liệu tươi — `cache: 'no-store'`).
4. **Hành vi GHI (refund/decide/moderate) qua server action hoặc route handler
   + confirm dialog** — quyết cụ thể khi làm F2/F3/F4, nhưng bất biến: mọi
   hành vi ghi có confirm trước khi bắn, lỗi 422/502 của contract hiện
   nguyên nghĩa cho admin (không nuốt thành "Something went wrong").
5. **Copy English trong `@tourism/i18n`** (khối `admin.*`), comment tiếng
   Việt, tokens-only — như mọi bề mặt khác.

## 3. Cắt tính năng — 1 tính năng = 1 session thi công

Quy trình mỗi tính năng: session mới nhận prompt (phát từ session gốc) → làm
ĐÚNG phạm vi trên branch riêng → `pnpm gate:int` xanh → commit (KHÔNG merge,
KHÔNG push) → báo cáo → user kiểm localhost → quay về session gốc nghiệm thu,
merge rebase+ff, docs sweep.

### F1 — Bookings đọc (branch `feat/p4b-bookings-read`)

- Nền `apps/admin/src/lib/api/`: client oRPC (quyết định §2.3) + module
  `bookings.ts` (list theo `AdminBookingsListQuerySchema`, byCode).
- `/bookings`: bảng từ kit data-table — 6 cột đã đặt; filter status (tab hoặc
  select theo enum BookingStatus), ô search, phân trang server theo §2.2.
- `/bookings/[code]`: chi tiết read-only theo `AdminBookingDetailSchema`
  (khách, đợt, tiền, payments, lịch sử cancellation). CHƯA có nút refund.
- `lib/nav.ts`: Bookings `enabled: true` (header tự đúng theo vòng shell).
- TDD logic thuần: hàm `searchParams → input` (parse/clamp page, status hợp
  lệ, q trim) + mapper hiển thị (tiền, ngày, guests = adults+children).
- KHÔNG làm: refund, hai vùng còn lại, sửa data-table phần dashboard đang
  dùng (tách/copy sang kit riêng nếu cần, đừng phá trang `/`).

### F2 — Refund (branch `feat/p4b-bookings-refund`)

- Nút + dialog refund trên `/bookings/[code]`: amount (partial/full) + note,
  confirm 2 bước, map ĐỦ 5 lỗi contract (NOT_REFUNDABLE · OVER_TOTAL ·
  ZERO_OR_NEGATIVE · NOTHING_LEFT · REFUND_FAILED) thành copy i18n riêng.
- Hiện ledger refund đã có trên trang chi tiết (data từ byCode).
- KHÔNG làm: đụng flow thanh toán web, hai vùng còn lại.

### F3 — Cancellations (branch `feat/p4b-cancellations`)

- `/cancellations`: hàng đợi từ kit (filter status REQUESTED/DENIED/REFUNDED),
  hàng nào REQUESTED có approve/deny + confirm nêu rõ hệ quả approve (refund
  phần còn lại + huỷ booking + nhả ghế); lỗi ALREADY_DECIDED/NOT_REFUNDABLE/
  REFUND_FAILED hiện nguyên nghĩa. Link chéo sang `/bookings/[code]`.
- `lib/nav.ts`: Cancellations enabled.

### F4 — Reviews moderation (branch `feat/p4b-reviews`)

- `/reviews`: hàng đợi (mặc định tất cả, filter approved/pending), nội dung
  review + rating + ảnh (nếu có) + tour; approve/unapprove + confirm nhắc hệ
  quả (recompute rating + email cho khách). `lib/nav.ts`: Reviews enabled.

## 4. Definition of done (mỗi tính năng)

1. `pnpm gate:int` xanh (int test cần Docker Postgres — máy dev có sẵn).
2. Test mới cho logic thuần của tính năng; test admin cũ không đỏ.
3. Commit Conventional tiếng Việt có dấu, KHÔNG AI-attribution (kiểm
   `git log` sau commit — trailer hay tự chèn).
4. Ở lại trên branch — merge + docs sweep là việc của session nghiệm thu.
5. Báo cáo cuối phiên: gì đã đổi, file nào, test bao nhiêu, lệnh dev server
   cho user tự chạy kiểm (`cd apps/admin && pnpm dev` + API nếu cần).
