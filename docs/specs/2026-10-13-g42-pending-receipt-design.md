# G42 — Màn hoá đơn chờ cho đơn chưa trả (spec, 13/10/2026)

> **Trạng thái:** viết theo phương án **A "Voucher chờ"** đang chờ user chọn trên thẻ quyết định
> (13/10). User chọn B thì viết lại mục 4 và 5 trước khi thi công.
> Bản vẽ: [Artifact G42](https://claude.ai/artifact/SPpWi4F17Jq3YrixWHTmGR); bản ghi vào
> `docs/design/mockups/pending-receipt.src.html` sau khi user chọn.

## 1. Bối cảnh

Open-items G42: đơn chưa trả ở `/checkout/cancel` và `/checkout/success` (lúc chờ cổng báo về) vẫn
dựng `BookingReceipt` từ 19/08 — thẻ hoá đơn "in ra từng khối", pill "Confirming", cuống vé ngang.
Nó lạc giọng với voucher màn hình (spec P7 §6) mà khách thấy ngay sau khi trả, và với bản in B1
(spec G40 §4). User để ý ở lượt thử tay production 12/10 (đơn BK-DICJ1A7T), ghi treo vì sát freeze,
rồi 13/10 07:16 UTC bảo làm trước freeze 15/10 nếu kịp.

Phần chữ của G37 (`heldNote`, câu cuống đơn đã đóng) đã xong ở `37f1464` và G40 Phần 1; spec này
giữ đúng các câu ấy ở chỗ chúng còn đúng.

## 2. Phạm vi

**Đổi:** màn hình (không phải bản in) của đơn có `paidAt` null ở hai trang `/checkout/cancel` và
`/checkout/success`.

**Không đổi:**

- Bản in B1 (`ReceiptPrint`, `receiptPrintView`) — cùng trang, lúc in vẫn ra tờ B1 như cũ.
- Voucher của đơn đã trả (`VoucherCard`) và luật chuyển trang `cancelPageRedirect`.
- API, contract, migration, dependency: không có. Nút Pay now gọi đúng `bookings.checkout` mà trang
  chi tiết đơn đang gọi.
- App mobile.

## 3. Bốn trạng thái

Trạng thái suy từ `status`, `bookingPhase(booking, vietnamToday(now))` và trang đang dựng — hàm
thuần `pendingView(booking, now, page)` ở `apps/web/src/lib/pending-receipt.ts`:

| Trạng thái | Khi nào | Mộc | Tiêu đề | Câu phụ | Nút chính |
| --- | --- | --- | --- | --- | --- |
| `payable` | trang cancel, `PENDING`, giai đoạn `awaiting_payment` | `bookingPass().stamp` (AWAITING PAYMENT) | "Payment cancelled" | `heldNote` mới (mục 6), kèm câu số phút còn lại khi chưa hết mốc | **Pay now · {tổng}** |
| `confirming` | trang success, `PENDING` (mọi giai đoạn: cổng vừa báo trả xong, claim còn có thể nhận) | như trên | "Confirming your payment…" | `pendingBody` | dòng "Checking with {cổng}…" và nút Refresh; trang tự làm tươi (`CheckoutAutoRefresh`) như hôm nay |
| `notPaid` | trang cancel, `PENDING`, giai đoạn `lapsed` | `bookingPass().stamp` (NOT PAID) | "Payment not completed" | `closedNarrative(booking, 'lapsed')` | Book this tour again |
| `closed` | `status` khác `PENDING` (huỷ, hết hạn, bị thu rồi hoàn tự động) | `bookingPass().stamp` | "This booking is closed" | `receiptNote(booking, 'settled')` — câu khoản hoàn khi từng bị thu | Book this tour again |

Mộc lấy từ `bookingPass` để một đơn mang cùng mộc ở mọi nơi (vé trang chi tiết đơn, accordion,
hộ chiếu). Bản vẽ ghi "CLOSED" cho đơn đã đóng; thi công theo `bookingPass` (đơn huỷ khi chưa trả ra
"CANCELLED"). Nút Pay now chỉ ở `payable`, cùng luật với trang chi tiết đơn (giai đoạn
`awaiting_payment` mới có `AwaitingPaymentPanel`).

## 4. Bố cục (phương án A)

Một thẻ như `VoucherCard`: chia hai cột từ `voucher-split:` (`xl`), cột trái co giãn, cột phải 440px
**nền `bg-muted`** thay cho mảng teal. Dưới `xl` một cột, cột phải xuống cuối theo thứ tự DOM.

**Cột trái** (`PendingOverview`):

1. Mộc `VisaStamp` (cùng chỗ như voucher: dưới `sm` đứng trên tiêu đề, từ `sm` cùng hàng).
2. Tiêu đề `h2`, câu phụ.
3. Dưới `xl`: ô mã gọn (viền đứt) kèm nút Pay now ngay dưới câu phụ — trên điện thoại khách thấy
   hành động trước ảnh.
4. Thẻ ảnh bìa lớn như voucher (tách phần ảnh của `VoucherOverview` thành linh kiện dùng chung),
   kicker "{nơi} · {n} day(s)", tên tour, tổng tiền, hai chip ngày đi và "{n} adult(s) × {đơn giá}".
   Đơn `closed`/`notPaid`: ảnh xám (`grayscale`).
5. Lưới bốn ô có icon (một cột dưới `sm`): ô mốc thời gian (`payable`: "Pay by {HH:MM · Ddd D Mon}",
   tông cảnh báo; `confirming`: "Booked {ngày giờ}"; `notPaid`/`closed`: mốc theo câu kết cục) · ô cổng
   thanh toán kèm câu test mode · ô Lead traveller · ô Need help (email liên hệ của site).

**Cột phải** (`PendingPass`):

1. Ô mã nền card, viền đứt: nhãn "Booking code · not yet a voucher" (đơn đóng: "Booking code"), mã,
   `CopyCodeButton`; dòng ngày đi và số khách (không "Admit": chưa phải giấy vào cổng); dòng điều
   kiện có icon (`stubNotYetVoucher`; `payable` thêm "Seats aren’t held until you pay."; đơn đóng:
   `closedStubSentence`); dải gạch chéo thay mã vạch: "Unpaid" · "Confirming" · "Not paid" ·
   "Closed". Từ `xl` ô này hiện ở cột phải; dưới `xl` giấu vì cột trái đã có ô gọn (cùng luật
   `voucher-stack:` của voucher).
2. Receipt overview: `bookingPriceLines`, dòng tổng "Total due" (đơn đóng chưa thu: "Charged · $0";
   bị thu rồi hoàn: dòng hoàn như voucher).
3. Trip journal: Booked ✓ → Payment (mốc đang đứng: "Pay by …" hay "Confirming with {cổng}") → Tour
   day. Đơn đóng: Booked ✓ → kết cục (✕). `notPaid`: Booked ✓ → "Payment not completed" (đang đứng,
   như `lapsedJourney` của trang chi tiết đơn).
4. Nút theo bảng mục 3, rồi link "View booking".

Hero giữ `ContentHero` (navbar cần mảng tối, lý do ở comment hiện có). Breadcrumb của đơn chưa trả
đổi "Voucher" thành "Checkout". Nút Print của hero giữ như hôm nay (chỉ trang success).

## 5. Linh kiện

- `lib/pending-receipt.ts` — `pendingView()` thuần, TDD. Trả mọi chữ đã định dạng, cờ `payNow`,
  `autoRefresh`, mộc, nhật ký, dòng tiền. Component không tự đọc `status` hay giai đoạn.
- `components/checkout/pending-card.tsx` (`PendingCard`, server) ghép `PendingOverview` và
  `PendingPass`.
- Nút Pay now: `BookingActions` với `actions: ['payNow']` (cùng lời gọi API, cùng xử lý lỗi của trang
  chi tiết đơn), không viết lại đường thanh toán.
- Ảnh bìa: tách khối ảnh của `VoucherOverview` ra `VoucherPhoto` dùng chung, không chép.
- Gỡ `BookingReceipt`, spec của nó, và khoá i18n mồ côi theo sau (bài học G38).

## 6. Chữ (tiếng Anh, vào `@tourism/i18n`)

Dùng lại khi đã có: `booking.cancel.title`, `booking.success.pendingTitle`, `pendingBody`,
`stubNotYetVoucher`, `stubClosed`, `printDoc.receipt.payBy`, `releasedAt`, `notYetVoucher`,
`accountBookingDetail.actions.payNow`, `tourDetail.booking.testMode`, `bookingDetail.journey.*`.

Mới (khối `pendingReceipt`):

- `breadcrumb`: "Checkout"
- `heldNote`: "No charge was made. Your booking stays open until {HH:MM} (Vietnam time) — seats aren’t
  held until you pay." Thay câu cũ "…from My bookings within the hour" vì nay có nút ngay trên trang.
- `seatsNotHeld`: "Seats aren’t held until you pay."
- `codeLabelPending`: "Booking code · not yet a voucher"
- `bands`: "Unpaid" · "Confirming" · "Not paid" · "Closed"
- `totalDue`: "Total due"; `charged`: "Charged"
- `checkingWith(provider)`: "Checking with {provider}…"; `voucherAppearsHere`: "The voucher appears here
  as soon as payment is confirmed."
- `closedTitle`: "This booking is closed"
- `bookAgain`: "Book this tour again"
- `tourDay`: "Tour day"; `released`: "Released, unpaid"

Luật cũ giữ nguyên: không đồng hồ đếm ngược, không chữ "held" hay "reserved" theo nghĩa giữ chỗ
(invariant #1 của API), không mã vạch cho đơn chưa trả, giờ luôn ghi giờ Việt Nam.

## 7. Kiểm

- **Unit (TDD, `pending-receipt.spec.ts`):** bốn trạng thái theo bảng mục 3 ở cả hai trang; Pay now chỉ
  ở `payable`; `confirming` cả khi đơn đã qua hạn chót; đơn bị thu rồi hoàn không nói "no payment was
  taken"; mốc Pay by kẹp ở hết ngày hạn chót (`pendingDeadline`); không chuỗi nào chứa "held" theo
  nghĩa giữ chỗ hay "reserved".
- **Component (`pending-card.spec.tsx`):** mỗi trạng thái hiện đúng mộc, tiêu đề, nút; không mã vạch;
  ô mã gọn và ô mã cột phải cùng một mã; link "Book this tour again" trỏ `/tours/{slug}`.
- **Đo trên bản build** (Playwright, đơn thật trong DB dev ở bốn trạng thái): 320, 375, 768, 1024,
  1280, 1440px, sáng và tối — không cuộn ngang, không chữ tràn, ảnh có `sizes` đúng. Ảnh chụp gửi
  user trước merge.
- `pnpm gate:int` xanh trước khi khai xong.

## 8. Rủi ro

- Sát freeze: mỗi bước một commit; nếu không kịp, `BookingReceipt` vẫn chạy và chưa bị gỡ cho tới
  commit cuối.
- `confirming` trên điện thoại: khách đứng ở trang này vài giây, ô mã gọn và dòng "Checking…" phải
  thấy ngay mà không cuộn.
