# G42 — Plan thi công màn hoá đơn chờ (13/10/2026)

Spec: [2026-10-13-g42-pending-receipt-design.md](../specs/2026-10-13-g42-pending-receipt-design.md),
phương án A user chọn 13/10. Nhánh `feat/g42-pending-receipt`, mỗi bước một commit, một draft PR.
Không API, không contract, không migration, không dependency mới.

## Bước

1. **Bản ghi mockup** — chép bản vẽ đã duyệt vào `docs/design/mockups/pending-receipt.src.html`
   (ảnh trỏ `apps/web/public/mock/hoian.jpg`, không nhúng base64).
2. **Chữ** — khối `pendingReceipt` ở `libs/shared/i18n` (mục 6 của spec).
3. **Logic (TDD)** — `apps/web/src/lib/pending-receipt.spec.ts` trước, rồi `pending-receipt.ts`:
   `pendingView(booking, now, page)` cho bốn trạng thái; xuất `refundJournal` của `lib/voucher.ts`.
   Đơn mẫu là đơn của bản in B1 (Hội An, 1 người lớn × $39, đặt 17:59 ngày 9/10).
4. **Ảnh bìa dùng chung** — tách `VoucherPhoto` khỏi `VoucherOverview` (test voucher giữ xanh, thêm
   cờ ảnh xám).
5. **Linh kiện** — `PendingCard`, `PendingOverview`, `PendingPass`, `PendingAction` cùng
   `pending-card.spec.tsx` (mỗi trạng thái: mộc, tiêu đề, hành động, không mã vạch, link Book again).
6. **Hai trang** — `/checkout/cancel` và nhánh chưa trả của `/checkout/success` dựng `PendingCard`
   trong lề `VOUCHER_PAGE_GUTTER`, breadcrumb "Checkout"; bản in B1 giữ nguyên.
7. **Dọn** — gỡ `BookingReceipt`, spec của nó, `cancelPageNote`, khoá i18n mồ côi (grep cả
   `apps/mobile`, `apps/admin`, `libs`), sửa JSDoc còn nhắc `BookingReceipt`.
8. **Đo** — bản build với API sống, đơn thật trong DB dev ở bốn trạng thái; Playwright ở 320, 375,
   768, 1024, 1280, 1440px, sáng và tối: không cuộn ngang, không chữ tràn, ảnh có `sizes`. Ảnh chụp
   gửi user.
9. **`pnpm gate:int`** xanh, đẩy nhánh, mở draft PR. Merge chỉ khi user nói trong thread.

## Quyết định nhỏ đã chốt lúc lập plan

- Hành động chính vẽ hai lần (ô gọn dưới `xl`, cột phải từ `xl`) bằng `voucher-split:hidden` và
  `voucher-stack:hidden`, cùng cách ô mã của voucher; không dời DOM bằng `order`.
- Nhật ký của thẻ chờ vẽ trên nền `muted` nên có `JournalItem` riêng màu `foreground`, không ép
  `JournalItem` teal của `VoucherPass` nhận thêm tham số màu.
- `receiptNote` và `checkoutMood` giữ: câu phụ của đơn đã đóng vẫn đọc `receiptNote(…, 'settled')`.
