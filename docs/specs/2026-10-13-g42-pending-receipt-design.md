# G42 — Màn hoá đơn chờ cho đơn chưa trả (spec, 13/10/2026)

> **Trạng thái:** user chọn phương án **A "Voucher chờ"** trên thẻ quyết định (13/10 07:32 UTC). Thi
> công xong, merge 13/10 (`docs/CHANGELOG.md`).
> Bản vẽ: [Artifact G42](https://claude.ai/artifact/SPpWi4F17Jq3YrixWHTmGR), bản ghi nguyên văn ở
> [`docs/design/mockups/pending-receipt.src.html`](../design/mockups/pending-receipt.src.html).
> Chữ chốt lúc thi công lệch bản vẽ ở vài chỗ để dùng lại khoá i18n sẵn có — xem mục 6.

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
| `payable` | trang cancel, `PENDING`, giai đoạn `awaiting_payment` | AWAITING PAYMENT | "Payment cancelled" | `heldNote(giờ nhả)`; qua mốc mà cron chưa quét thì bản không giờ | **Pay now** |
| `confirming` | trang success, `PENDING` ở mọi giai đoạn (cổng vừa báo trả xong, claim còn nhận phiên mở trước hạn) | AWAITING PAYMENT | "Confirming your payment…" | `pendingBody` | dòng "Checking with {cổng}…" và nút Refresh; trang tự làm tươi (`CheckoutAutoRefresh`) như hôm nay |
| `notPaid` | trang cancel, `PENDING`, giai đoạn `lapsed` | NOT PAID | "Payment not completed" | `closedNarrative(booking, 'lapsed')` | Book again |
| `closed` | `status` khác `PENDING` (huỷ, hết hạn, bị thu rồi hoàn tự động) | `bookingPass().stamp` (CANCELLED, REFUNDED) | "This booking is closed" | `receiptNote(booking, 'settled')` — câu khoản hoàn khi từng bị thu | Book again |

Mộc lấy từ `bookingPass` để một đơn mang cùng mộc ở mọi nơi (vé trang chi tiết đơn, accordion,
hộ chiếu). Bản vẽ ghi "CLOSED" cho đơn đã đóng; thi công theo `bookingPass` (đơn huỷ khi chưa trả ra
"CANCELLED"). Riêng `confirming` luôn mang mộc AWAITING PAYMENT dù đơn đã qua hạn chót: mộc NOT PAID
đứng cạnh "Confirming your payment…" là hai câu ngược nhau trên một màn. Nút Pay now chỉ ở `payable`,
cùng luật với trang chi tiết đơn (giai đoạn `awaiting_payment` mới có `AwaitingPaymentPanel`).

## 4. Bố cục (phương án A)

Một thẻ như `VoucherCard`: chia hai cột từ `voucher-split:` (`xl`), cột trái co giãn, cột phải 440px
**nền `bg-muted`** thay cho mảng teal. Dưới `xl` một cột, cột phải xuống cuối theo thứ tự DOM.

**Cột trái** (`PendingOverview`):

1. Mộc `VisaStamp` (cùng chỗ như voucher: dưới `sm` đứng trên tiêu đề, từ `sm` cùng hàng).
2. Tiêu đề `h2`, câu phụ.
3. Dưới `xl`: ô mã gọn (viền đứt) và hành động chính ngay dưới câu phụ — trên điện thoại khách thấy
   Pay now (hay dòng "Checking…") trước ảnh.
4. Ảnh bìa lớn như voucher (tách phần ảnh của `VoucherOverview` thành `VoucherPhoto` dùng chung),
   kicker "{nơi} · {n} day(s)", tên tour, tổng tiền, hai chip ngày đi và "{n} adult(s) × {đơn giá}".
   Đơn `closed`/`notPaid`: ảnh xám (`grayscale`).
5. Lưới bốn ô có icon (một cột dưới `sm`): ô mốc (`payable` còn mốc: "Pay by {HH:MM} · {Ddd D Mon}",
   tông cảnh báo; còn lại: "Booked" và giờ đặt) · ô cổng thanh toán kèm câu test mode · ô Lead
   traveller · ô Need help (link `/contact`).

**Cột phải** (`PendingPass`):

1. Ô mã nền card, viền đứt: nhãn "Booking code · not yet a voucher" (đơn `notPaid`/`closed`: "Booking
   code"), mã, `CopyCodeButton`; dòng ngày đi và số khách khi đơn còn mở (không "Admit": chưa phải
   giấy vào cổng); dòng điều kiện (`payable`: `stubNotYetVoucher` và "Seats aren’t held until you
   pay."; `confirming`: `stubNotYetVoucher`; `closed`: `closedStubSentence`; `notPaid`: không câu nào,
   cùng luật dòng xé của bản in); dải gạch chéo thay mã vạch: "Unpaid" · "Confirming" · "Not paid" ·
   "Closed" (đơn bị thu rồi hoàn: chữ trạng thái, như cuống bản in). Cả ô chỉ hiện từ `xl`; dưới đó
   cột trái đã có ô gọn.
2. Receipt overview: `bookingPriceLines`, dòng tổng ("Total due" khi còn mở, "Total" khi đã đóng hay
   quá hạn), rồi "Charged · $0" (đóng mà chưa thu) hay "Refunded −$…" (bị thu rồi hoàn, cả khối đủ hai
   số lẻ như voucher).
3. Trip journal: Booked ✓ (giờ đặt) → "Awaiting payment" ("Pay by …") hay "Confirming" (tên cổng) →
   "Pickup day" (chữ của voucher). `notPaid`: Booked ✓ → "Payment not completed" (như `lapsedJourney`
   của trang chi tiết đơn). `closed`: Booked ✓ → kết cục ✓ (`closedNarrative`, ngày `cancelledOn`) →
   mốc Refund khi từng bị thu (`refundJournal` của voucher).
4. Hành động chính (từ `xl`), rồi link "View booking".

Hero giữ `ContentHero` (navbar cần mảng tối, lý do ở comment hiện có). Breadcrumb của đơn chưa trả
đổi "Voucher" thành "Checkout". Nút Print của hero giữ như hôm nay (chỉ trang success).

## 5. Linh kiện

- `lib/pending-receipt.ts` — `pendingView()` thuần, TDD. Trả mọi chữ đã định dạng, mộc, dòng tiền,
  nhật ký và hành động chính. Component không tự đọc `status` hay giai đoạn.
- `components/checkout/pending-card.tsx` (`PendingCard`, server) ghép `PendingOverview` và
  `PendingPass`; `PendingAction` vẽ hành động chính ở hai chỗ (ô gọn dưới `xl`, cột phải từ `xl`).
- Nút Pay now: `BookingActions` với `actions: ['payNow']` (cùng lời gọi API, cùng xử lý lỗi của trang
  chi tiết đơn), không viết lại đường thanh toán.
- Ảnh bìa: tách khối ảnh của `VoucherOverview` ra `VoucherPhoto` dùng chung, không chép.
- Gỡ `BookingReceipt`, spec của nó, `cancelPageNote`, và khoá i18n mồ côi theo sau (bài học G38).

## 6. Chữ (tiếng Anh, vào `@tourism/i18n`)

Dùng lại khi đã có: `booking.cancel.title`, `booking.success.pendingTitle`, `pendingBody`,
`statusConfirming`, `stubNotYetVoucher`, `stubClosed`, `viewBooking`, `printDoc.receipt.payBy`,
`unpaid`, `stampClosed`, `bookAgain`, `voucher.codeLabel`, `receiptHeading`, `refunded`,
`journal.*`, `bookingDetail.journey.awaitingPayment`, `paymentNotCompleted`,
`bookingDetail.ticket.notPaid`, `tourDetail.booking.testMode`, `passportVisa.contactUs`.

Mới (khối `pendingReceipt`):

- `breadcrumb`: "Checkout"
- `heldNote(until)`: "No charge was made. Your booking stays open until {HH:MM on Ddd D Mon} (Vietnam
  time) — seats aren’t held until you pay."; `until` null: "…is still open — seats aren’t held until
  you pay." Thay `booking.cancel.heldNote` ("…from My bookings within the hour") vì nay có nút ngay
  trên trang.
- `payByNote`: "After that the booking is released. Vietnam time."
- `seatsNotHeld`: "Seats aren’t held until you pay."
- `codeLabel`: "Booking code · not yet a voucher"
- `totalDue`: "Total due"; `charged`: "Charged"
- `checkingWith`: theo cổng — "Checking with Stripe…" · "Checking with PayPal…"
- `closedTitle`: "This booking is closed"
- `helpBody`: "— we reply within a day." (đứng sau link "Contact us")

So với bản vẽ: mốc cuối nhật ký là "Pickup day" của voucher (bản vẽ "Tour day"), nút đặt lại là
"Book again" của bản in (bản vẽ "Book this tour again"), không có dòng "The voucher appears here…"
vì `pendingBody` đã nói trang tự làm tươi, và đơn đã đóng ghi kết cục thật (`closedNarrative`) thay
cho "Released, unpaid" — web không phân biệt được đơn bị cron nhả với đơn khách tự huỷ.

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
