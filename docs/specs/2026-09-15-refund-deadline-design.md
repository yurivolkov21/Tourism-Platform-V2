# Spec — Một hạn chót mỗi chuyến: hoàn tiền đơn giản và chốt chặn đặt chỗ

15/09/2026 · quyết định kiến trúc ở
[ADR-0041](../adr/0041-single-cancellation-deadline.md). Mọi quyết định dưới đây
đã được user duyệt từng phần trong phiên brainstorming ngày 15/09 (năm câu hỏi
làm rõ, năm phần thiết kế).

Spec này chỉ mô tả **sẽ xây gì**. Các bước thực thi nằm ở plan đi kèm, viết sau
khi spec được duyệt.

**Thay thế:** bảng bậc 100/50/25/0, ân hạn 24 giờ và phép ghép badge
`freeCancellationDays` của [ADR-0030](../adr/0030-refund-policy-tiers.md); luồng
khách gửi yêu cầu, admin duyệt của
[ADR-0029](../adr/0029-cancellation-approve-partial-refund.md); mục CÒN TREO
"chốt chặn đặt chỗ 3 ngày" (CHANGELOG 04/09).

Không đối chiếu Nexora (CLAUDE.md luật 10): repo tham chiếu không còn trên máy từ
14/09 theo quyết định của user.

## 1. Vấn đề

Hoàn tiền hiện có ba luật chạy trên hai chiếc đồng hồ: bảng bậc và badge của tour
đếm ngày tới khởi hành, còn ân hạn đếm giờ từ lúc trả tiền. Chốt chặn đặt chỗ
đang treo sẽ là luật thứ tư. Đợt rà 15/09 (ba agent song song, các phát hiện then
chốt kiểm lại bằng tay) chỉ ra năm xung đột nếu thêm chốt chặn, cùng một gốc:
**lời hứa hoàn tiền kéo dài qua thời điểm chỗ không còn bán lại được.**

1. 14 tour trong seed có badge 1–2 ngày, ngắn hơn mốc chặn 3 ngày. Khách huỷ ở
   ngày cuối vẫn được 100% nhưng chỗ trả về rơi vào khoảng không ai đặt được.
2. Ân hạn 24 giờ trả chỗ vào khoảng bị chặn với người đặt sát mốc. Chỗ lại chỉ
   được nhả khi admin duyệt, nên duyệt chậm thì chỗ càng lọt sâu.
3. Mốc biên đang được hiểu hai kiểu: CHANGELOG 04/09 ghi "dưới 3 ngày", ADR-0030
   §3c ghi "vùng 4–6 ngày".
4. Chỉ chặn ở `create` là hở: booking PENDING gọi `reCheckout` lặp lại sống được
   tới trần 24 giờ (`PENDING_HARD_TTL_HOURS`).
5. Form "Inquire Now" chưa có đường thu tiền, nên khách đi gấp nằm ngoài mọi luật.

Lỗi có sẵn đo cùng đợt, thiết kế này sửa luôn:

- **Thước ngày UTC.** `start_date` là ngày lịch Việt Nam còn server so bằng ngày
  UTC. Với tour badge 1 ngày, khách gửi yêu cầu lúc 05:00 sáng ngày khởi hành
  vẫn được 100% (tới 06:59 giờ Việt Nam), kể cả khi tour đã đón khách trước bình
  minh; chuyến cũng còn đặt được tới 06:59 sáng hôm sau ngày đi.
- **Dòng "refund available until…" ở checkout** chỉ đọc bảng bậc và giờ máy
  khách, bỏ qua badge và ân hạn: tour badge 3, còn 20 ngày thì ghi 50% trong khi
  server hoàn 100%.
- **P&L** chỉ tính doanh thu của booking PAID và PARTIALLY_REFUNDED: tiền giữ lại
  của booking đã huỷ biến mất; giá vốn bỏ sót khách được hoàn thiện chí toàn bộ
  nhưng vẫn đi tour.
- **Email** báo "reviews every request within 48 hours", web ghi "2 business
  days".

## 2. Quyết định đã chốt

| # | Quyết định | Lý do |
| --- | --- | --- |
| Q1 | Mọi tour hoàn đủ hoặc không hoàn; một hạn chót cho mỗi chuyến; N tối đa 7 ngày | Rộng rãi và dễ giải thích nhất; ngoài hai ca ở §3.6, không tour nào hoàn ít hơn hiện nay |
| Q2 | Trước hạn chót khách tự huỷ, hoàn ngay, không chờ admin | Quyết định trước hạn là tất định; duyệt tay chỉ thêm độ trễ, và độ trễ làm chỗ nhả muộn |
| Q3 | Sau hạn chót khách vẫn tự huỷ, không hoàn; ngoại lệ đi qua form liên hệ và hoàn thiện chí | Phần duy nhất cần con người là ngoại lệ; bỏ được cả luồng duyệt |
| Q4 | Công ty huỷ chuyến vì bất kỳ lý do gì, kể cả bất khả kháng: hoàn 100% tự động, bỏ lời hứa đổi ngày. Nút "Cancel departure" làm ở P4e-1 | Một luật, không ngoại lệ phải đo đếm; màn quản lý chuyến của P4e-1 là chỗ tự nhiên của nút |
| Q5 | N tự tính từ độ dài chuyến: 1 ngày → 1, 2–3 ngày → 3, từ 4 ngày → 7 | Không ai phải cấu hình, không cần cột chụp; so với seed hiện tại mọi thay đổi đều hạ N |
| Q6 | Gỡ hẳn vùng Cancellations của admin | Huỷ chỉ còn là một trạng thái booking; trang Bookings xem đủ |
| Q7 | Trạng thái "đã ngừng nhận đặt" và "còn huỷ miễn phí" luôn do server tính | Không tin giờ trình duyệt; giáo viên hay chỉnh đồng hồ máy khi thử |

**Nguyên tắc chung:** chỗ còn bán lại được thì hoàn đủ; không bán lại được nữa
thì không tự hoàn.

## 3. Luật

### 3.1 Hạn chót của một chuyến

- Độ dài chuyến `L` = ngày về − ngày đi + 1, tính theo ngày lịch.
- `N` = 1 khi `L` = 1; `N` = 3 khi `L` là 2 hoặc 3; `N` = 7 khi `L` ≥ 4.
- Ngày chót `D` = ngày khởi hành − `N` ngày. Hạn chót kết thúc lúc 23:59:59 giờ
  Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7, không đổi giờ theo mùa) của ngày `D`.
- "Còn trong hạn" nghĩa là ngày hôm nay theo giờ Việt Nam ≤ `D`.

| Ví dụ | L | N | Khởi hành | Ngày chót |
| --- | --- | --- | --- | --- |
| `hanoi-heritage-day` | 1 | 1 | 20/10 | 19/10 |
| `mekong-can-tho-2d` | 2 | 3 | 20/10 | 17/10 |
| `ha-giang-loop-4d` | 4 | 7 | 20/10 | 13/10 |

### 3.2 Đặt chỗ

- `bookings.create` và `bookings.checkout` ("Pay again") chỉ chạy khi chuyến còn
  trong hạn, cộng các điều kiện đang có (tour published, chuyến OPEN, còn chỗ).
- Thanh toán đang dở lúc hạn chót trôi qua **vẫn được nhận**: claim khi webhook
  về chỉ giữ điều kiện "chuyến OPEN và chưa khởi hành", đổi sang ngày Việt Nam.
  Trễ tối đa bằng đời trang thanh toán (Stripe 60 phút, PayPal 3 giờ). Booking đó
  đã qua hạn nên không còn huỷ miễn phí. Chọn nới cho khách thay vì thu tiền rồi
  tự hoàn.
- Chuyến đã qua hạn nhưng chưa khởi hành vẫn hiện trên trang tour với nhãn
  "Booking closed" và nút sang `/tours/{slug}/enquire`.

### 3.3 Khách huỷ

- Áp cho booking của chính khách ở trạng thái PAID hoặc PARTIALLY_REFUNDED.
  Booking REFUNDED (đã được hoàn thiện chí toàn bộ) không huỷ online; khách liên
  hệ.
- Huỷ online được tới hết ngày trước ngày khởi hành (giờ Việt Nam). Từ ngày khởi
  hành: không còn nút huỷ; không đến là vắng mặt, không hoàn.
- Còn trong hạn: hoàn toàn bộ phần chưa hoàn, `total_amount − SUM(refunds)`. Quá
  hạn: hoàn 0.
- Mỗi lần huỷ làm trọn trong một giao dịch:
  - booking → CANCELLED, ghi `cancelled_at`, trả chỗ;
  - ghi một dòng `cancellation_requests` trạng thái REFUNDED (kể cả khi hoàn 0,
    giữ nghĩa "đã giải quyết" như hiện nay), `decided_by` là chính khách,
    `decided_at` là lúc huỷ, `reason` tuỳ chọn;
  - ghi dòng `refunds` nếu số tiền lớn hơn 0;
  - xếp email `BOOKING_CANCELLED`.
- Không có hàng đợi duyệt, không có trạng thái "đang chờ".

### 3.4 Ngoại lệ

Ốm đau, việc gấp: khách gửi form `/tours/{slug}/enquire` (enquiry ghi `userId`
khi đăng nhập). Admin xem xét rồi dùng `admin.bookings.refund`, bắt buộc số tiền
và lý do nội bộ (ghi lên `refunds.reason`), áp được cả cho booking CANCELLED còn
tiền chưa hoàn.

### 3.5 Công ty huỷ chuyến

- Luật: với mọi booking đã trả của chuyến, hoàn toàn bộ phần chưa hoàn, booking →
  CANCELLED, gửi email. Không có lựa chọn đổi ngày; khách tự đặt chuyến khác.
- Đợt này chỉ viết **lõi huỷ dùng chung** (§4.4), nhận người thao tác và cách
  tính tiền. Nút "Cancel departure", màn chọn chuyến và xử lý hoàn lỗi hàng loạt
  thuộc P4e-1.
- Trong lúc chờ P4e-1: admin hoàn thiện chí thủ công từng booking.
- Nếu P4e-1 thêm sửa hạn chót cho từng chuyến: chỉ cho **hạ** `N`, để không phải
  xử lý lại booking đã đặt.

### 3.6 So với luật hiện tại

Với mọi tour và mọi thời điểm huỷ, mức hoàn mới không thấp hơn mức hiện tại, trừ
hai ca:

1. Đặt đúng ngày chót rồi sang ngày hôm sau mới huỷ, vẫn trong 24 giờ sau khi trả
   tiền: ân hạn cũ cho 100%, luật mới cho 0%. Đây đúng là ca chỗ trả về không còn
   bán được.
2. Yêu cầu gửi trong khung 00:00–06:59 giờ Việt Nam: thước UTC cũ đếm dư một
   ngày, luật mới đếm đúng. Đây là sửa lỗi.

Booking đặt trong N ngày cuối (hiện được phép) không còn tạo được; đó là mục đích
của chốt chặn, không phải thay đổi mức hoàn.

## 4. Dữ liệu và API

### 4.1 Luật chung ở `@tourism/contract`

`libs/shared/contract/src/schemas/refund-policy.ts` viết lại thành bộ hàm thuần
dùng chung cho API, web, admin, seed và email. Tên dưới đây là dự kiến, plan có
thể đổi:

| Hàm | Trả về |
| --- | --- |
| `tripLengthDays(startDate, endDate)` | `L` |
| `cancellationWindowDays(startDate, endDate)` | `N` ∈ {1, 3, 7} |
| `cancellationDeadline(startDate, endDate)` | `D`, dạng `YYYY-MM-DD` |
| `vietnamToday(now)` | ngày lịch hiện tại theo giờ Việt Nam |
| `isWithinDeadline(now, startDate, endDate)` | hôm nay ≤ `D` |
| `canCancelOnline(now, startDate)` | hôm nay < ngày khởi hành |
| `refundOnCancel({ now, startDate, endDate, totalAmount, refundedTotal })` | phần còn lại hoặc `'0.00'` |

- Giữ các hàm tiền theo cent (`toCents`, `fromCents`, `remainingRefundable`).
- Xoá `REFUND_POLICY_TIERS`, `REFUND_GRACE_HOURS`, các hàm `refundPercentFor*`,
  `isWithinGracePeriod`, `fullRefundThresholdDays`, `policyRefundAmount`.
- Giờ Việt Nam phía Node lấy bằng `Intl.DateTimeFormat` với
  `timeZone: 'Asia/Ho_Chi_Minh'`; phía SQL dùng
  `(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`. SQL chỉ cần so "chưa khởi
  hành"; luật `N` chỉ sống ở Node, không viết lại trong SQL.

### 4.2 Migration

Hai migration, thêm trước rồi xoá sau, vì site đang chạy thật và Vercel thường
deploy xong trước Render:

- **M1, chạy trước khi deploy code** (không làm code cũ hỏng):
  - `ALTER TYPE "EmailType" ADD VALUE 'BOOKING_CANCELLED'`;
  - `ALTER TABLE cancellation_requests ALTER COLUMN reason DROP NOT NULL`;
  - `ALTER FUNCTION public.refunds_sum_within_total() SET search_path = public, pg_temp`
    (mục CÒN TREO 09/09).
- **M2, nhánh nhỏ riêng, chạy sau khi code mới đã sống:** xoá cột
  `tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days`.
  Xoá trước thì Prisma client của code cũ vẫn đọc hai cột này và lỗi.
- Không thêm cột chụp `N`: booking đã lưu `departure_start_date` và
  `departure_end_date`.
- Ba giá trị `CANCELLATION_REQUESTED`, `CANCELLATION_APPROVED`,
  `CANCELLATION_DENIED` ở lại trong enum cho dữ liệu cũ, không phát sinh mới.

### 4.3 Contract

| Mục | Thay đổi |
| --- | --- |
| `bookings.create`, `bookings.checkout` | Chặn sau hạn chót; vẫn một mã `DEPARTURE_NOT_AVAILABLE` |
| `bookings.cancel` | Đổi nghĩa thành huỷ ngay. Input `{ code, reason? }` (trim, tối đa 1000). Output: booking sau khi huỷ kèm số tiền đã hoàn. Lỗi `NOT_FOUND`, `NOT_CANCELLABLE` (422), `REFUND_FAILED` (502); bỏ `ALREADY_REQUESTED` |
| `BookingSchema` | Bỏ `freeCancellationDays`; thêm `cancellationDeadline` (ngày) |
| `bookings.byCode` | `refundEstimate` đổi thành `cancellation: { deadline, withinDeadline, refundAmount, canCancel }`, `null` khi booking không ở PAID hoặc PARTIALLY_REFUNDED |
| `CancellationRequestSchema` | `reason` cho phép `null`; bỏ `freeCancellationDays` |
| `catalog.tours.bySlug` | Bỏ `freeCancellationDays`; mỗi chuyến thêm `bookingDeadline` và `bookable`. `bookable` do server tính và chỉ nghĩa "còn trong hạn đặt"; còn chỗ hay không vẫn đọc từ `seatsLeft`. Vẫn trả chuyến đã qua hạn nhưng chưa khởi hành |
| `catalog.tours.list` | Giá "from" chỉ tính chuyến còn trong hạn |
| `admin.cancellations.list`, `admin.cancellations.decide`, `admin.stats.cancellations` | Xoá, cùng các schema chỉ chúng dùng |
| `admin.bookings.refund` | Bỏ `CANCELLATION_OPEN`; cho booking CANCELLED còn tiền chưa hoàn |
| Báo cáo tháng | `cancellationsApproved`, `cancellationsDenied` đổi thành hai số huỷ trong hạn và quá hạn |

### 4.4 Lõi huỷ dùng chung

Một hàm ở `CancellationsService` nhận booking, người thao tác (khách; sau này là
hệ thống) và cách tính tiền (theo luật; sau này "hoàn toàn bộ"). Toàn bộ chạy
trong `withBookingRefundLock(bookingId)`:

1. Đọc lại booking mới nhất và kiểm tra: đúng chủ (với khách), trạng thái PAID
   hoặc PARTIALLY_REFUNDED, có `provider_payment_id`, chưa tới ngày khởi hành.
2. Tính số tiền bằng `refundOnCancel` trên sổ đọc trong khoá.
3. Tiền lớn hơn 0 thì gọi `executeGatewayRefund` **trước**, khoá chống trùng
   `cancel:<bookingId>`. Một booking chỉ huỷ được một lần nên khoá này ổn định
   qua mọi lần thử lại.
4. Một câu SQL (CTE): chuyển booking sang CANCELLED, ghi yêu cầu REFUNDED, ghi
   dòng `refunds` khi tiền lớn hơn 0, trả chỗ (`seats_booked − party`, guard
   `seats_booked >= party`), xếp outbox `BOOKING_CANCELLED` với dedupe
   `booking-cancelled:<bookingId>`.

| Tình huống | Kết quả |
| --- | --- |
| Cổng thanh toán lỗi | 502 `REFUND_FAILED`; không ghi gì; booking giữ nguyên, khách thử lại được |
| Bấm hai lần, hai tab | Lần sau chờ khoá, thấy CANCELLED → 422 `NOT_CANCELLABLE` |
| Crash sau khi cổng thanh toán đã hoàn, trước commit | Lần thử lại tính ra đúng số cũ, cùng khoá chống trùng, provider trả kết quả cũ rồi ghi sổ. Quá thời gian provider giữ khoá thì lỗi được log để đối soát (cùng loại rủi ro ADR-0009 đã chấp nhận) |
| Admin hoàn thiện chí cùng lúc | Cùng khoá booking nên chạy tuần tự; số tiền tính lại từ sổ mới nhất |
| Guard trả chỗ không khớp | Log cho người vận hành, giao dịch vẫn commit (giữ hành vi hiện nay) |
| Tổng hoàn vượt tổng tiền | Trigger `refunds_sum_within_total` chặn, lưới cuối giữ nguyên |

Xoá `request`, `approve`, `deny` của `CancellationsService` và phép kiểm
`CancellationOpenError` trong `refundByAdmin`.

### 4.5 Múi giờ

Mọi phép so ngày liên quan chuyến đi chuyển sang giờ Việt Nam: `create`,
`reCheckout`, CTE claim và nhánh phân loại sau claim, ước tính hoàn
(`bookings.service.ts`); lọc chuyến ở `catalog.service.ts`; huỷ; kiểm tra "còn
chuyến chưa kết thúc" khi xoá tài khoản (`account.service.ts`). Chuỗi theo ngày
của dashboard (ADR-0036) giữ UTC.

Ghi nhận khi rà 15/09: `reCheckout` chưa kiểm `isPublished` và chưa soft-check
ghế như `create`. Plan cân nhắc gom điều kiện đặt chỗ vào một hàm dùng chung cho
cả hai.

## 5. Giao diện khách, email, văn bản pháp lý

Khách luôn thấy một ngày cụ thể; mọi câu nhắc hạn chót sinh từ luật chung; giờ
ghi rõ "Vietnam time". Mọi quyết định phụ thuộc giờ do API hoặc phần render phía
server tính, không dùng giờ trình duyệt (Q7).

### 5.1 Trang tour

- Thẻ chính sách huỷ: "Free cancellation until N days before departure" và "After
  that, bookings close and cancellations aren't refunded.", thay cho câu "our
  standard refund schedule applies".
- Mỗi chuyến trong danh sách ghi "Free cancellation until 17 Oct".
- Chuyến có `bookable = false`: hiện nhưng không chọn được, nhãn "Booking
  closed", nút "Ask about this trip".
- Không còn chuyến đặt được: một câu chung kèm nút hỏi, thay "Every scheduled
  departure is sold out" hay "still being confirmed".
- Mục chính sách huỷ trong "Good to know" sinh từ luật; không đọc `TourPolicy`
  loại CANCELLATION nữa.

### 5.2 Thanh toán

- Bước xem lại và phần tóm tắt: "Free cancellation until 17 Oct, 11:59 pm
  Vietnam time. No refund after that." Luôn in ngày cụ thể, kể cả khi ngày chót
  là hôm nay, để web không phải so với giờ trình duyệt (Q7).
- Thay dòng "refund available until…" hiện tính bằng giờ máy khách.
- "Pay now" gặp `DEPARTURE_NOT_AVAILABLE`: "Booking for this departure has
  closed."
- Trang thanh toán thành công: thay "cancel anytime" bằng ngày chót.

### 5.3 Trang booking của khách

- `cancellation.canCancel` đúng thì có nút "Cancel booking".
- Hộp xác nhận hai dạng:
  - Trong hạn: "Cancel and get a full refund of $1,200? It usually reaches your
    original payment method in 5–10 business days." Nút "Cancel and refund
    $1,200".
  - Quá hạn: "The free-cancellation deadline (17 Oct) has passed. If you cancel
    now, you won't be refunded." Kèm link "Something serious happened? Contact
    us". Nút "Cancel without refund".
  - Ô lý do không bắt buộc.
- Huỷ xong: trạng thái đã huỷ, số tiền đã hoàn. `REFUND_FAILED`: "We couldn't
  process your refund, so your booking hasn't changed. Please try again."
  `NOT_CANCELLABLE`: làm mới trang.
- Bỏ các trạng thái "requested / pending / resubmit", phần ước tính theo phần
  trăm, số ngày, ân hạn, và mục "What happens next".
- Lịch sử yêu cầu cũ (REQUESTED, DENIED) trên dữ liệu cũ vẫn hiện dạng chỉ đọc
  cho tới lượt seed lại.

### 5.4 Email

- Xác nhận đặt chỗ: thêm dòng hạn chót, tính từ `startDate` và `endDate` vốn đã
  có trong payload.
- `BOOKING_CANCELLED` mới, hai biến thể: đã hoàn `$X`; đã huỷ, không hoàn. P4e-1
  thêm biến thể công ty huỷ chuyến.
- Không phát sinh `CANCELLATION_REQUESTED`, `CANCELLATION_APPROVED`,
  `CANCELLATION_DENIED`. Giữ template của chúng tới khi outbox không còn dòng chờ
  gửi loại này, rồi xoá.
- `BOOKING_REFUNDED` (hoàn thiện chí, hoàn tự động) giữ nguyên.

### 5.5 Văn bản pháp lý, FAQ, câu quảng bá

- `/cancellation-policy` và `/terms` viết lại, sinh từ luật chung, sáu ý:
  1. Hạn chót theo độ dài chuyến (bảng ba dòng), tính tới 11:59 pm giờ Việt Nam.
  2. Ngừng nhận đặt chỗ đúng lúc hạn chót hết; cần đi gấp thì liên hệ.
  3. Huỷ online tới trước ngày khởi hành: trong hạn hoàn đủ; quá hạn hoặc vắng
     mặt không hoàn.
  4. Thời gian tiền về: 5–10 ngày làm việc, về phương thức thanh toán ban đầu.
  5. Công ty huỷ vì bất kỳ lý do gì: hoàn 100%.
  6. Trường hợp đặc biệt: liên hệ để được xem xét.
- Bỏ: bảng bậc, ân hạn 24 giờ, câu "a cancellation request does not cancel the
  booking automatically" kèm hẹn khoảng 2 ngày làm việc, lời hứa đổi ngày, vế
  "based on what we can recover from suppliers". Xoá `legal/refund-tiers.ts`.
- FAQ (`messages.ts`, `apps/web/src/mocks/faq.ts`), thanh trên cùng, trang About,
  dải cam kết: một câu đúng cho mọi tour, ví dụ "Free cancellation on every
  tour", kèm link chính sách.
- Giữ câu về phiên bản điều khoản áp dụng tại thời điểm đặt trong `/terms`.

### 5.6 Ngoài phạm vi

Mobile (P5b dùng cùng contract và chuỗi chữ khi dựng màn booking), chatbot (P6
trả lời theo trang chính sách), email nhắc sắp hết hạn huỷ.

## 6. Admin và báo cáo

- **Gỡ vùng Cancellations:** mục thanh bên, `/cancellations`,
  `/cancellations/[code]`, stepper duyệt, nút duyệt và từ chối, thẻ thống kê của
  vùng, cùng lib và test đi kèm (`approve-refund.ts`, `cancellations-decide.ts`,
  `cancellations-query.ts`, `cancellations-view.ts`, `api/cancellations.ts`).
  Booking đã huỷ xem bằng bộ lọc trạng thái của `/bookings`.
- **Chi tiết booking:** khối lịch sử huỷ ghi ai huỷ, lúc nào, trong hay quá hạn
  chót, hoàn bao nhiêu, lý do.
- **Nút hoàn thiện chí:** hiện khi booking PAID, PARTIALLY_REFUNDED, hoặc
  CANCELLED còn tiền chưa hoàn; bỏ điều kiện `hasOpenCancellation`. Vẫn bắt buộc
  số tiền và lý do.
- **Báo cáo tháng và Excel:** cặp "approved / denied" đổi thành "cancelled within
  the deadline" và "cancelled after the deadline", đếm theo `decided_at` trong
  kỳ; xếp loại bằng hàm luật chung trên `created_at` của yêu cầu cùng ngày đi,
  ngày về của booking.
- **P&L (sửa ADR-0033):**
  - doanh thu = `SUM(total_amount − refunded)` của mọi booking có `paid_at`, trên
    chuyến không bị huỷ, theo `departure_end_date` trong kỳ;
  - giá vốn biến đổi và số booking của P&L: booking có `paid_at` và trạng thái
    khác CANCELLED (khách thực đi, gồm cả REFUNDED do hoàn thiện chí);
  - giá vốn cố định: điều kiện "có ít nhất một khách" dùng cùng tập khách thực đi.
- **Outbox:** thêm `BOOKING_CANCELLED` vào menu loại; ba loại cũ vẫn lọc được.
- Giữ nguyên: tỉ lệ huỷ trên thẻ `/bookings`, chuỗi doanh thu theo ngày, Payment
  events.

## 7. Seed

- **Catalog:** bỏ `freeCancellationDays` ở cả 29 tour và các `TourPolicy` loại
  CANCELLATION; giữ loại BOOKING và GENERAL. Comment bất biến "câu chữ khớp số" ở
  `schema.prisma` bỏ cùng M2.
- **Vận hành** (`fixtures/operations/bookings.ts`), chỉ sinh hình dạng app mới
  tạo được:
  - khách tự huỷ trong hạn: booking CANCELLED, yêu cầu REFUNDED do chính khách,
    hoàn đủ phần còn lại, có sự kiện hoàn tiền;
  - khách tự huỷ quá hạn: booking CANCELLED, yêu cầu REFUNDED, không dòng hoàn;
  - bỏ yêu cầu DENIED (xin đổi ngày) và REQUESTED (đang chờ);
  - giữ chuyến công ty huỷ trong lịch sử dạng hoàn thiện chí 100%, vì trước P4e-1
    đó là cách duy nhất app làm được.
- **Mốc:** `paid_at` và giỏ bỏ dở chỉ nằm trước hạn chót của chuyến; seed hiện
  cho thanh toán và bỏ dở giỏ sát ngày khởi hành hơn mức này.
- **Demo:** bảo đảm có vài booking đã trả trên chuyến đã qua hạn nhưng chưa khởi
  hành.
- **`seed:verify` thêm:** không booking nào có `paid_at` sau hạn chót; mỗi lần huỷ
  trong hạn có đúng một dòng hoàn bằng phần còn lại, huỷ quá hạn không có dòng
  hoàn; không có yêu cầu REQUESTED hay DENIED. Giữ các kiểm tra hiện có (CANCELLED
  đã trả có đúng một yêu cầu REFUNDED; yêu cầu đã quyết có `decided_by`).
- Seed vẫn gọi đúng hàm luật của contract để tính tiền, như hiện nay.

## 8. Test

- **Giữ**, chỉ đổi dữ liệu nếu cần: trigger tổng hoàn, advisory lock, chống trùng
  gọi cổng thanh toán, trả chỗ, lịch sử yêu cầu append-only, các luồng tự hoàn
  (overbooked, departure-closed, orphaned capture, dup capture), claim song song,
  CHECK ghế. Ca dựng trên chuyến +45 ngày đổi sang chuyến khác, không bỏ bất
  biến.
- **TDD cho logic thuần mới:** `L`, `N`, `D`; ngày Việt Nam ở các mốc 23:59:59 và
  00:00; khung 00:00–06:59 giờ Việt Nam (UTC còn là hôm trước); số tiền hoàn;
  ranh giới đúng ngày chót và đúng ngày khởi hành.
- **Integration mới:**
  - huỷ trong hạn và quá hạn; bấm hai lần song song; cổng thanh toán lỗi thì
    không ghi gì; PARTIALLY_REFUNDED hoàn phần còn lại; đúng ngày khởi hành bị
    chặn; người khác huỷ nhận 404;
  - tạo booking và `checkout` bị chặn sau hạn; claim vẫn nhận thanh toán tới sau
    hạn;
  - catalog trả `bookingDeadline`, `bookable`; giá "from" bỏ chuyến quá hạn;
  - `admin.bookings.refund` trên booking CANCELLED còn dư;
  - báo cáo đếm hai loại huỷ; P&L tính tiền giữ lại của booking đã huỷ;
  - xoá tài khoản so theo ngày Việt Nam.
- **Web và admin:** trang tour (chuyến đóng, không còn chuyến), dòng hạn chót ở
  checkout, hai dạng hộp xác nhận và các lỗi, nút hoàn thiện chí với CANCELLED.
- **Email:** render hai biến thể `BOOKING_CANCELLED` và dòng hạn chót của email
  xác nhận.
- **Xoá:** test của bảng bậc, ân hạn, stepper, `decide`, `approve-refund`, và các
  ca seed theo bậc.
- Khai xong khi `pnpm gate:int` xanh (CLAUDE.md luật 11); logic mới phủ ≥ 80%.

## 9. Tài liệu

- Đi cùng spec này: ADR-0041.
- Khi code merge (docs sweep, luật 13):
  - ADR-0029 và ADR-0030: dòng trạng thái "thay một phần bởi ADR-0041";
  - AMEND ở ADR-0009 (thước giờ Việt Nam thay UTC của AMEND 2), ADR-0023 (bỏ
    `freeCancellationDays`), ADR-0033 (định nghĩa doanh thu, giá vốn);
  - `docs/conventions/booking-states.md`: bảng terminal thêm dòng khách tự huỷ,
    bỏ luồng duyệt;
  - seed spec 14/09: câu "Không cần ADR… không có migration" ở §2, yêu cầu phủ đủ
    4 bậc, rủi ro "lịch sử theo ân hạn 24 giờ" ở §9, lượt 2 ở §8.5;
  - prompt P4e-1 ở `docs/plans/2026-09-08-prompts-cac-phase-con-lai.md` §1a: thêm
    nút "Cancel departure" dùng lõi §4.4;
  - `docs/CHANGELOG.md`: entry mới, đóng hai mục CÒN TREO (chốt chặn 3 ngày,
    `search_path`);
  - `docs/README.md`: cập nhật trạng thái dòng spec và ADR.

## 10. Triển khai

Session thi công không chạm hạ tầng sống (CLAUDE.md luật 15): các bước 2, 3, 5, 6
và 7 do session gốc hoặc user làm, sau review.

1. Thi công trên nhánh riêng, trong worktree riêng (session mobile chạy song
   song), qua review.
2. Chạy M1 lên Supabase.
3. User tạm tắt tự deploy của Vercel cho web và admin. Không pause hay suspend
   project nào: làm vậy là tắt hẳn site.
4. Rebase, merge `--ff-only`, push `main`; chờ CI xanh (luật 14) và Render deploy
   xong API.
5. Bật lại tự deploy Vercel, redeploy web và admin để build với API mới.
6. Seed lại prod theo runbook ở seed spec 14/09 §8.3 (snapshot, reset chạy khô,
   reset thật, seed, verify).
7. Nhánh nhỏ thứ hai: M2 xoá hai cột, merge, chạy lên Supabase.
8. Lượt seed 2 khoảng 03/11 vẫn chạy theo §8.5 của seed spec, với code seed mới.

Lý do thứ tự bước 3–5: Vercel và Render build độc lập, Vercel gần như luôn xong
trước, và client oRPC không validate response. Web mới đứng cạnh API cũ vài phút
từng làm 500 mọi lượt vào một trang admin; CHANGELOG ghi bài học "deploy API
trước rồi mới đẩy consumer".

## 11. Demo

- **Huỷ trong hạn, được hoàn:** đặt booking mới bằng thẻ test Stripe trên chuyến
  còn xa, rồi huỷ; xem dòng hoàn trên trang booking, trang admin và Stripe test
  dashboard. Không dùng booking seed cho luồng này: mã thanh toán seed là giả nên
  trả `REFUND_FAILED`. Tài khoản đưa giám khảo tự thử nên là tài khoản mới tạo.
- **Huỷ quá hạn, không hoàn:** dùng booking seed trên chuyến đã qua hạn; luồng
  này không gọi cổng thanh toán.
- **Ngừng nhận đặt:** mở tour có chuyến đã qua hạn, thấy "Booking closed"; gọi
  API tạo booking bị chặn.
- **Chỉnh đồng hồ máy:** không đổi kết quả vì mọi quyết định do server tính.

## 12. Rủi ro và giới hạn đã biết

- **Tụt 100% → 0% ngay sau hạn chót.** Bù bằng ngày chót in ở trang tour,
  checkout, email xác nhận, trang booking; ngoại lệ đi qua hoàn thiện chí.
- **Hạn theo ngày lịch, không theo giờ đón khách:** tour một ngày huỷ được tới
  23:59 hôm trước, có thể chỉ vài giờ trước giờ đón. Copy nói ngày, không nói
  "24 hours".
- **Cache trang tour 300 giây:** `bookable` có thể trễ tối đa 5 phút quanh hạn
  chót; API tạo booking vẫn chặn đúng giờ.
- **Thanh toán dở qua hạn:** booking hợp lệ nhưng không còn huỷ miễn phí (trễ tối
  đa 3 giờ với PayPal).
- **Chuyến công ty huỷ trước khi có P4e-1:** chưa có nút; chuyến vẫn mở bán nếu
  không sửa dữ liệu tay.
- **Dữ liệu cũ giữa bước 4 và bước 6 của §10:** yêu cầu REQUESTED còn trên prod
  nhưng route duyệt đã xoá; lượt seed lại ngay sau đó dọn sạch.
- **Booking seed không hoàn tiền được** (mã thanh toán giả), đã nêu ở §11.

## 13. Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ bảng bậc, thêm chốt chặn rồi vá năm chỗ xung đột | Thêm 3–4 luật phụ, đúng thứ user muốn tránh |
| Chỉ bỏ ân hạn, không làm chốt chặn | Quay lại lỗi "người đặt muộn không bao giờ được 100%" (04/09), kém rộng rãi |
| Một hạn chót chung 3 ngày cho mọi tour | Tour trong ngày mất kênh bán sát giờ; tour dài được huỷ miễn phí tới 3 ngày trước |
| Tour dài giữ mốc 10–30 ngày | Tour mốc 30 ngày ngừng nhận khách từ 30 ngày trước; khách huỷ từ hạn chót tới 7 ngày trước mất trắng (hiện được 25–50%) |
| Tách hai mốc cho tour dài (đặt tới 3 ngày, huỷ miễn phí tới 10–30) | Khách đặt sau mốc huỷ miễn phí không được hoàn ngay từ đầu; khách phải hiểu hai ngày |
| Thêm nấc hoàn một phần sau hạn chót | Hoàn tiền lúc chỗ đã không bán lại được, đúng loại xung đột đang bỏ |
| N nhập tay cho từng tour (1–7) | 29 con số ẩn, cần ô nhập và cột chụp; mất tính công khai của luật |
| Admin vẫn duyệt yêu cầu trước hạn | Duyệt cho có; độ trễ làm chỗ nhả sau hạn; hàm duyệt còn không kiểm ngày khởi hành |
| Tự động duyệt ngầm sau vài phút | Thêm hàng đợi, yêu cầu kẹt khi lỗi; phức tạp hơn tự huỷ mà không lợi hơn |
| Sau hạn khách gửi yêu cầu, admin quyết | Giữ gần như toàn bộ máy duyệt cho một ca hiếm |
| Sau hạn không cho huỷ online | Số khách của chuyến sai; ngoại lệ hoàn trên booking PAID thành REFUNDED với nghĩa "vẫn đi" |
| Chặn cả lúc xác nhận thanh toán sau hạn | Thu tiền rồi tự hoàn, email lý do sai, cho một khoảng trễ vài phút tới vài giờ |
| Làm nút "Cancel departure" ngay đợt này | Cần màn tạm sẽ bị thay ở P4e-1; phạm vi phình |
| Giữ trang Cancellations dạng chỉ xem | Vẫn phải sửa bảng, bộ lọc, thẻ thống kê; trang Bookings đã đủ |
| Làm chốt chặn bằng cách tự chuyển chuyến sang CLOSED | Kích hoạt auto-refund `departure-closed` với thanh toán đang dở; lẫn với đóng bán thủ công |

## 14. Hoàn thành khi

- `pnpm gate:int` xanh; logic mới phủ ≥ 80%.
- Code không còn `REFUND_POLICY_TIERS`, `REFUND_GRACE_HOURS`, `refundEstimate`,
  `admin.cancellations.*`; sau M2 không còn `freeCancellationDays`. Migration và
  entry CHANGELOG cũ là bản ghi lịch sử, không tính.
- `seed:verify` 0 vi phạm trên Docker với H = 20/09 và H = 03/11.
- Kiểm tay ở máy (Docker, không gọi cổng thanh toán thật): chuyến đã qua hạn hiện
  "Booking closed" và API chặn đặt; huỷ quá hạn không hoàn; cổng lỗi thì không ghi
  gì. Lượt sandbox thật (đặt → huỷ trong hạn → Stripe hoàn → sổ và email) chạy ở
  bước triển khai §10, sau khi API mới đã sống trên Render.
- Tài liệu cập nhật như §9.
