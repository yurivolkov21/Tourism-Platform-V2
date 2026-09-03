import { Injectable } from '@nestjs/common';
import {
  type AdminBookingsStats,
  type AdminCancellationsStats,
  type AdminEnquiriesStats,
  type AdminOutboxStats,
  type AdminPaymentEventsStats,
  type AdminReviewsStats,
  type AdminSubscribersStats,
  OPEN_ENQUIRY_STATUSES,
  PAYMENT_EVENT_STUCK_MINUTES,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { CancellationRequestStatus, OutboxStatus } from '../../generated/prisma/enums.js';
import {
  bookingsCreatedCount,
  decisionsSlice,
  enquiriesCreatedCount,
  enquiryWonCount,
  outboxSentCount,
  paidBookingsSlice,
  paymentEventsSlice,
  revenueCurrency,
  reviewApprovals,
  subscribersStats,
} from './stats-aggregates.js';
import { average, grossAmount, ratePercent, statsPeriod, statsWindow } from './stats-math.js';

/**
 * Số liệu vùng admin (spec P4b §3-F5) — ba bộ metric cho ba trang vùng.
 *
 * ## Vì sao MODULE RIÊNG chứ không nhét vào BookingsModule/ReviewsModule
 *
 * Ba bộ số là MỘT bề mặt với MỘT khái niệm chung: cửa sổ 28-ngày-đôi. Rải
 * chúng về ba module chủ quản sẽ chép phép cắt cửa sổ ba lần (và P4d dashboard
 * là lần thứ tư) — đúng thứ đã đẻ ra ba bản `Paginated*` của Nexora. Ngoài ra
 * module chủ quản tồn tại để canh bất biến GHI (money-path, transaction
 * moderation 4-trong-1); aggregate chỉ ĐỌC, không có bất biến nào để canh, và
 * BookingsModule vốn đã gánh ba service cộng một cycle `forwardRef`.
 *
 * Các câu aggregate dùng chung với báo cáo tháng (F6) nằm ở
 * `stats-aggregates.ts` — service này giữ phần RIÊNG của cửa sổ 28-ngày-đôi
 * (ảnh chụp hàng đợi tại một mốc) và phần dựng response. Định nghĩa metric
 * thì vẫn kể ở ĐÂY, một chỗ duy nhất.
 *
 * ## Định nghĩa TỪNG metric (đây là số admin đem so sổ — đọc kỹ trước khi sửa)
 *
 * Cửa sổ: kỳ này `[now − 28d, now)`, kỳ trước `[now − 56d, now − 28d)`. Hai kỳ
 * DÀI BẰNG NHAU, khít nhau, mốc UTC (xem `statsWindow`). Mọi khoảng đều
 * nửa-mở `gte … lt` nên không hàng nào bị đếm hai lần ở chỗ giáp ranh.
 *
 * **bookings**
 * - `revenue` — `SUM(total_amount)` của booking có `paid_at` TRONG kỳ. Neo
 *   theo `paid_at` chứ không `created_at`: booking tạo ngày 1 mà trả tiền
 *   ngày 30 là doanh thu của ngày 30. GROSS — refund phát về sau KHÔNG bị trừ
 *   ở đây (sổ cái `refunds` mới là nơi kể chuyện tiền đi ra, xem
 *   docs/conventions/booking-states.md). Query đối chứng:
 *   `SELECT SUM(total_amount) FROM bookings WHERE paid_at >= $from AND paid_at < $to`.
 * - `paidBookings` — ĐẾM đúng tập vừa sinh ra `revenue`, nên
 *   `revenue / paidBookings` luôn là giá trị đơn hàng trung bình thật.
 * - `newBookings` — đếm theo `created_at`, MỌI trạng thái (kể cả PENDING bỏ
 *   dở). Đây là nhu cầu đổ vào, không phải doanh thu.
 * - `cancellationRate` — PHẦN TRĂM booking ĐÃ TRẢ TIỀN trong kỳ mà tới thời
 *   điểm đọc đang ở `CANCELLED` HOẶC `REFUNDED`. Hai trạng thái chứ không
 *   một (vòng vá review F5): huỷ qua queue cho `CANCELLED`, nhưng hoàn ĐỦ
 *   tiền qua đường refund trực tiếp cho `REFUNDED` mà không bao giờ đụng
 *   `CANCELLED` (`deriveStatusAfterRefund`) — đếm thiếu nhánh đó là card in
 *   0% trong khi tiền đã về hết. `PARTIALLY_REFUNDED` KHÔNG tính: goodwill
 *   refund một phần, khách vẫn đi. Mẫu số CHÍNH LÀ `paidBookings`, nên hai
 *   con số trên cùng hàng card kiểm chéo được nhau. Vì sao mẫu số là "đã trả
 *   tiền" chứ không phải mọi booking: `CANCELLED` còn là trạng thái của
 *   checkout bỏ dở (PENDING hết TTL 65′) — lấy mẫu số rộng thì con số này
 *   biến thành tỉ lệ bỏ giỏ hàng, không phải tỉ lệ huỷ. `null` khi kỳ không
 *   có booking nào trả tiền (không có mẫu số).
 *   LƯU Ý ĐỌC SỐ: đây là tỉ lệ theo LỨA đo tại thời điểm đọc — booking mới
 *   trả tiền hôm qua chưa kịp bị huỷ, nên kỳ này thường thấp hơn kỳ trước
 *   một chút vì lý do thuần thời gian.
 *
 * **cancellations**
 * - `pendingQueue` — ẢNH CHỤP hàng đợi đang mở, KHÔNG phải đếm trong kỳ:
 *   `current` = số request `REQUESTED` ngay bây giờ (đúng bằng số hàng
 *   `/cancellations?status=REQUESTED` hiện ra), `previous` = hàng đợi tại
 *   mốc đầu kỳ, dựng lại bằng "đã mở trước mốc đó VÀ chưa quyết tính đến mốc
 *   đó". Dựng lại được CHÍNH XÁC vì quyết định cancellation là chung cuộc
 *   (history append-only, `decided_at` ghi một lần — spec P2 D1-B).
 * - `approved` / `denied` — đếm theo `decided_at` trong kỳ (approve ⇒ trạng
 *   thái `REFUNDED`, xem booking-states.md).
 *
 * **reviews**
 * - `pending` — ẢNH CHỤP như trên: `current` = số review `is_approved =
 *   false` bây giờ (đúng bằng số hàng `/reviews?status=pending` hiện ra);
 *   `previous` = trạng thái duyệt suy ngược về mốc đầu kỳ. ⚠️ Khác
 *   cancellations, `moderated_at` KHÔNG phải dấu "đã có quyết định" — review
 *   ra đời đã duyệt sẵn thì nó vẫn null — nên phép dựng lại phải đọc cả
 *   `is_approved`; chi tiết + ca xấp xỉ còn lại ở `pendingReviewsAt`.
 * - `approved` — SỐ LƯỢT DUYỆT thực hiện trong kỳ, đếm trên audit trail
 *   `review_moderation_events` (`to_approved = true`, `created_at` trong
 *   kỳ) chứ KHÔNG trên trạng thái hiện tại của review (vòng vá review F5):
 *   đếm theo `is_approved && moderated_at` thì một cú un-approve hôm nay
 *   XOÁ NGƯỢC lượt duyệt khỏi kỳ đã đóng — hai admin chụp cùng một kỳ ra
 *   hai số khác nhau. Event là bất biến append-only nên số này đứng yên;
 *   guard no-op (vòng vá F4) bảo đảm không có event from===to làm nhiễu.
 * - `averageRating` — `AVG(rating)` trên review GỬI trong kỳ (`created_at`),
 *   KHÔNG lọc theo trạng thái duyệt và KHÔNG lọc theo nguồn. Cố ý: lọc
 *   "đã duyệt" sẽ khiến một hàng đợi tồn đọng tự kéo tụt kỳ này so với kỳ
 *   trước dù không khách nào đổi ý. Đây KHÁC số sao trên trang tour (chỉ đếm
 *   review đã duyệt của tour đó — `Tour.ratingAvg`), và khác một cách có chủ
 *   đích. `null` khi kỳ không có review nào.
 *
 * **outbox** (F7, spec P4c §3-F7 — siết ở vòng vá review F7)
 * - `sent` — số row `SENT` có `processed_at` TRONG KỲ NÀY. Neo `processed_at`
 *   chứ không `created_at`: email xếp hàng tuần trước mà hôm nay mới đi (sau
 *   một cú retry) là email giao hôm nay. CHỈ `SENT`: row `SKIPPED` (worker
 *   cố ý không gửi vì người nhận đã huỷ đăng ký) có `processed_at` nhưng
 *   chưa từng tới Resend — trước vòng vá chúng bị đánh SENT nên con số này
 *   từng nói dối. Query đối chứng:
 *   `SELECT COUNT(*) FROM outbox WHERE status = 'SENT' AND processed_at >= $from AND processed_at < $to`.
 *   KHÔNG có kỳ trước: purge cron xoá row SENT/SKIPPED cũ hơn 30 ngày
 *   (`OutboxService.purgeSent`), nên kỳ 28–56 ngày trước gần như trống —
 *   một cặp ở đây là pill "↑1200%" bịa mỗi ngày. Contract khai số đơn.
 * - `queued` — ẢNH CHỤP: số row `PENDING` ngay bây giờ, đúng bằng số hàng
 *   `/outbox?status=PENDING`. Không có "lúc đầu kỳ": trạng thái PENDING không
 *   để lại dấu thời gian nào khi rời đi, nên không dựng lại được — contract
 *   khai một số đơn thay vì bịa một cặp.
 * - `failed` — ẢNH CHỤP: số row `FAILED` ngay bây giờ (đúng bằng
 *   `/outbox?status=FAILED`). Đây là con số "cần người": hàng FAILED chỉ
 *   rời trạng thái đó khi admin retry.
 *   Cả hai ảnh chụp đọc TƯƠI mỗi request (admin KHÔNG cache 60s như ba vùng
 *   kia): kẻ đổi hàng đợi là worker drain mỗi phút, không phải một server
 *   action có `updateTag` — cache là card cãi nhau với bảng ngay bên dưới.
 *
 * **paymentEvents** (F8, spec P4c §3-F8)
 * - `received` — số webhook ĐÃ VERIFY chữ ký và được ghi sổ, theo
 *   `received_at` trong kỳ, MỌI provider và MỌI type (kể cả `other`: một
 *   `PAYMENT.CAPTURE.REFUNDED` echo về cũng là một delivery đã nhận). Đây là
 *   thông lượng webhook, không phải số thanh toán thành công — con số đó là
 *   `paidBookings`. Query đối chứng:
 *   `SELECT COUNT(*) FROM payment_events WHERE received_at >= $from AND received_at < $to`.
 *   Có kỳ trước: `received_at` ghi một lần lúc nhận, không purge, nên kỳ
 *   28–56 ngày trước dựng lại được thật (khác outbox).
 * - `unprocessed` — ẢNH CHỤP: số row `processed_at IS NULL` ngay bây giờ,
 *   đúng bằng `/payment-events?unprocessed=true`. "Đã nhận, handler chưa
 *   xong" — lượt trước crash giữa chừng, provider retry sẽ chạy lại
 *   (`PaymentsService.beginEvent`). Row như vậy còn tồn tại sau vài phút là
 *   dấu hiệu cần người soi. Không có "lúc đầu kỳ": `processed_at` chỉ ghi lúc
 *   xong, không ghi lúc bắt đầu chờ, nên không dựng lại được — số đơn.
 * - `linked` — trong tập `received` cùng kỳ, bao nhiêu row có `booking_id`
 *   (gateway rút từ metadata/custom_id của provider). Hiệu `received −
 *   linked` là webhook không quy được về đơn nào: event `other`, hoặc
 *   `payment_intent.payment_failed` không mang metadata session — đọc cùng
 *   nhau để thấy tỉ lệ "webhook mồ côi". Cột không có FK nên `booking_id` có
 *   thể trỏ tới booking đã không còn — ở đây vẫn đếm là "gắn" (nó ĐÃ gắn lúc
 *   nhận); còn list thì in `bookingCode` null cho row đó.
 * - `stuck` — trong `unprocessed`, row có `received_at` cũ hơn
 *   `PAYMENT_EVENT_STUCK_MINUTES` phút (vòng vá review F8). Null trong vài
 *   giây đầu là handler ĐANG chạy — bình thường; còn đó sau ngưỡng, tức
 *   provider đã retry ít nhất một lượt mà vẫn không xong, mới là "kẹt". Card
 *   chỉ kêu đỏ theo số này; `unprocessed` giữ nguyên nghĩa "khớp bảng".
 *   Admin KHÔNG cache (cùng luật outbox, vòng vá review F8): kẻ đổi sổ là
 *   webhook ngoài vòng `updateTag`, mà bảng bên dưới đọc tươi mỗi lần điều
 *   hướng — card cache 60s đứng cạnh bảng tươi là hai con số "unprocessed"
 *   khác nhau trên cùng một màn hình.
 *
 * **enquiries** (F9, spec P4c §3-F9)
 * - `created` — số lead GỬI trong kỳ theo `created_at`, MỌI trạng thái. Card
 *   đọc là "New 28d" nhưng con số này KHÔNG lọc `status = NEW`: một lead gửi
 *   hôm kia mà hôm nay đã WON vẫn là lead mới của kỳ. Query đối chứng:
 *   `SELECT COUNT(*) FROM enquiries WHERE created_at >= $from AND created_at < $to`.
 *   Có kỳ trước thật: bảng không purge (lead là dữ liệu kinh doanh, giữ vĩnh
 *   viễn — khác `outbox`).
 * - `won` — số LEAD có lượt chuyển sang WON trong kỳ (`DISTINCT enquiry_id`,
 *   vòng vá review F9: bấm nhầm rồi sửa lại là hai lượt của một lead), đếm
 *   trên audit trail `enquiry_status_events` (`to_status = 'WON'`,
 *   `created_at` của EVENT).
 *   KHÔNG đếm `enquiries WHERE status = 'WON' AND updated_at IN kỳ`, vì hai
 *   lý do đều làm hỏng một kỳ đã đóng: (a) `updated_at` bị MỌI lệnh ghi khác
 *   đè — thêm một note không đụng cột này nhưng một lần đổi trạng thái về sau
 *   thì có, nên một lead thắng tháng trước bị sửa hôm nay sẽ nhảy sang kỳ
 *   này; (b) trạng thái HIỆN TẠI không kể được chuyện "thắng rồi mất lại" —
 *   lead ấy vẫn phải giữ nguyên lượt thắng của kỳ nó thắng. Đây đúng bài học
 *   `approved` của reviews (F5), lần này có bảng audit ngay từ đầu. Guard
 *   no-op ở `setStatus` bảo đảm không có event `from === to` làm nhiễu.
 *   Query đối chứng:
 *   `SELECT COUNT(DISTINCT enquiry_id) FROM enquiry_status_events WHERE to_status = 'WON' AND created_at >= $from AND created_at < $to`.
 * - `open` — ẢNH CHỤP: số lead đang ở `OPEN_ENQUIRY_STATUSES` (NEW +
 *   CONTACTED + QUOTED) ngay bây giờ; WON/LOST là chung cuộc. Không có "lúc
 *   đầu kỳ" dựng lại được từ riêng dấu thời gian (một lead có thể đi qua
 *   nhiều trạng thái, và `enquiry_status_events` chỉ có từ F9 trở đi nên
 *   lịch sử trước đó trống) — contract khai số đơn. KHÔNG có callout đỏ:
 *   hàng chờ CRM là trạng thái bình thường của một đường bán hàng đang sống,
 *   khác `outbox.failed` (chỉ rời FAILED khi có người can thiệp).
 *   Admin KHÔNG cache (cùng luật outbox/payment events — vòng vá review F9):
 *   `created` và `open` đổi mỗi khi form "Inquire Now" CÔNG KHAI ghi một lead
 *   NEW, tức một kẻ đổi bảng ngoài mọi `updateTag` của admin; bảng bên dưới
 *   đọc tươi nên card cache 60s sẽ cãi nhau với chính tab NEW.
 *
 * **subscribers** (F10, spec P4c §3-F10)
 * - `created` — số địa chỉ ĐĂNG KÝ trong kỳ theo `created_at`, không lọc
 *   theo trạng thái hiện tại: một người đăng ký hôm kia rồi huỷ hôm nay vẫn
 *   là một lượt đăng ký của kỳ (cùng luật đặt tên với `enquiries.created` —
 *   card đọc "New 28d" nhưng con số không phải "đang active"). Hàng chỉ sinh
 *   MỘT lần cho mỗi địa chỉ (`upsert` theo email ở `NewsletterService.subscribe`)
 *   nên đây là số NGƯỜI mới, không phải số lượt bấm nút. Query đối chứng:
 *   `SELECT COUNT(*) FROM subscribers WHERE created_at >= $from AND created_at < $to`.
 *   Có kỳ trước thật: bảng không purge.
 * - `unsubscribed` — số địa chỉ RÚT CONSENT trong kỳ theo `unsubscribed_at`.
 *   Cột KHÁC `created_at`, nên một địa chỉ đăng ký kỳ trước mà huỷ kỳ này
 *   được đếm ở hai kỳ khác nhau của hai metric khác nhau — đó là đúng.
 *   ⚠️ ĐÂY LÀ CON SỐ DUY NHẤT CỦA CẢ BỀ MẶT STATS KHÔNG BẤT ĐỘNG: khách bấm
 *   link resubscribe trong email cũ của họ (`NewsletterService.resubscribe`)
 *   đặt cột này về null và lượt huỷ biến khỏi một kỳ đã đóng. Đúng họ vấn đề
 *   của `approved` (F5) và `won` (F9), nhưng hai vùng đó chữa bằng bảng audit
 *   còn F10 thì không thêm migration nào (spec §3-F10). Sai số nhỏ và luôn
 *   MỘT chiều (số đã in ra chỉ giảm); ngày cần bất động thì việc phải làm là
 *   một bảng `subscriber_consent_events` append-only, không phải sửa câu
 *   query này. Query đối chứng:
 *   `SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at >= $from AND unsubscribed_at < $to`.
 * - `active` — ẢNH CHỤP: số hàng `unsubscribed_at IS NULL` ngay bây giờ, đúng
 *   bằng số hàng của `/subscribers?active=true`. Không dựng lại được "lúc đầu
 *   kỳ" từ riêng hai mốc (một hàng huỷ rồi đăng ký lại xoá sạch dấu vết lượt
 *   huỷ), nên contract khai số đơn. KHÔNG có callout đỏ: đây là con số người
 *   ta MUỐN thấy lớn, khác hẳn hàng đợi `outbox.failed`.
 *   Admin KHÔNG cache (cùng luật outbox/payment events/enquiries): bảng này
 *   có BA kẻ ghi và chỉ một là admin — form footer công khai (`subscribe`) và
 *   đường HMAC trong email khách (`unsubscribe`/`resubscribe`) đều đổi cả ba
 *   con số ngoài mọi `updateTag`.
 *
 * ## Index
 *
 * CỐ Ý chưa thêm index nào cho các cột lọc theo thời gian (`bookings.paid_at`,
 * `cancellation_requests.decided_at`, `reviews.moderated_at`,
 * `outbox.processed_at` — index sẵn có `[status, created_at]` chỉ phủ vế
 * status; `payment_events.received_at` — index sẵn có `[provider, received_at]`
 * chỉ dùng được khi lọc provider, còn ảnh chụp `processed_at IS NULL` là ứng
 * viên cho một partial index khi tới ngưỡng). NGOẠI LỆ DUY NHẤT là bảng mới
 * của F9: `enquiry_status_events` sinh ra kèm `[to_status, created_at]` — đó
 * chính là câu query của metric `won`, và một bảng mới thì thêm index lúc
 * tạo không tốn gì (`enquiries.created_at` thì vẫn không có index riêng:
 * index sẵn có `[status, created_at]` phủ vế status của ảnh chụp `open`).
 * `subscribers` (F10) là bảng KHÔNG có index nào ngoài `email @unique`, và
 * vùng này không cache: mỗi lần render `/subscribers` là một lượt quét cho
 * stats (đã gộp thành MỘT câu `FILTER`) cộng `count`/`findMany`/`GROUP BY
 * source` của list. Bảng này lớn theo số người ghé web chứ không theo số
 * booking — ứng viên đầu tiên chạm ngưỡng; index đáng thêm khi tới:
 * partial `(created_at DESC) WHERE unsubscribed_at IS NULL` (tab mặc định)
 * và `(unsubscribed_at)` (metric kỳ). Ở cỡ dữ liệu hiện tại (hàng
 * trăm row) seq scan rẻ hơn cả việc bảo trì index, và một migration mới phải
 * deploy tay lên Supabase dùng chung
 * dev/prod. Ngưỡng để xem lại: khi một trong sáu bảng vượt ~10k row — `outbox`
 * là bảng ghi kiểu hàng đợi (mỗi booking/enquiry/newsletter một row) nên sẽ
 * chạm ngưỡng trước, dù retention 30 ngày che bớt khi nhìn `count(*)`.
 */
@Injectable()
export class StatsService {
  /** Bộ số vùng `/bookings`. Mọi aggregate PHÁT song song (Promise.all —
   *  5 query độc lập trên pool sau vòng gộp groupBy, không phải một
   *  round-trip). */
  async adminBookings(): Promise<AdminBookingsStats> {
    const window = statsWindow(new Date());
    const [current, previous, createdNow, createdBefore, currency] = await Promise.all([
      paidBookingsSlice(window.currentFrom, window.generatedAt),
      paidBookingsSlice(window.previousFrom, window.currentFrom),
      bookingsCreatedCount(window.currentFrom, window.generatedAt),
      bookingsCreatedCount(window.previousFrom, window.currentFrom),
      revenueCurrency(window.previousFrom, window.generatedAt),
    ]);

    return {
      period: statsPeriod(window),
      // Cửa sổ không có payment nào → 'USD' (mặc định cột `bookings.currency`).
      // Stat card chỉ dán nhãn `revenue` nên một nguồn là đủ; báo cáo tháng
      // mới phải hỏi thêm sổ hoàn (xem `ReportsService`).
      currency: currency ?? 'USD',
      revenue: { current: grossAmount(current.revenue), previous: grossAmount(previous.revenue) },
      paidBookings: { current: current.paid, previous: previous.paid },
      newBookings: { current: createdNow, previous: createdBefore },
      cancellationRate: {
        current: ratePercent(current.cancelledOfPaid, current.paid),
        previous: ratePercent(previous.cancelledOfPaid, previous.paid),
      },
    };
  }

  /** Bộ số vùng `/cancellations`. */
  async adminCancellations(): Promise<AdminCancellationsStats> {
    const window = statsWindow(new Date());
    const [pendingNow, pendingThen, current, previous] = await Promise.all([
      // "Bây giờ" đọc thẳng trạng thái, không dựng lại: card phải khớp ĐÚNG
      // số hàng của `/cancellations?status=REQUESTED`.
      prisma.cancellationRequest.count({ where: { status: CancellationRequestStatus.REQUESTED } }),
      this.pendingRequestsAt(window.currentFrom),
      decisionsSlice(window.currentFrom, window.generatedAt),
      decisionsSlice(window.previousFrom, window.currentFrom),
    ]);

    return {
      period: statsPeriod(window),
      pendingQueue: { current: pendingNow, previous: pendingThen },
      approved: { current: current.approved, previous: previous.approved },
      denied: { current: current.denied, previous: previous.denied },
    };
  }

  /** Bộ số vùng `/reviews`. */
  async adminReviews(): Promise<AdminReviewsStats> {
    const window = statsWindow(new Date());
    const [pendingNow, pendingThen, current, previous] = await Promise.all([
      prisma.review.count({ where: { isApproved: false } }),
      this.pendingReviewsAt(window.currentFrom),
      this.reviewsSlice(window.currentFrom, window.generatedAt),
      this.reviewsSlice(window.previousFrom, window.currentFrom),
    ]);

    return {
      period: statsPeriod(window),
      pending: { current: pendingNow, previous: pendingThen },
      approved: { current: current.approved, previous: previous.approved },
      averageRating: { current: current.rating, previous: previous.rating },
    };
  }

  /** Bộ số vùng `/outbox` (F7) — hai query: một count kỳ này, một groupBy ảnh chụp. */
  async adminOutbox(): Promise<AdminOutboxStats> {
    const window = statsWindow(new Date());
    const [sent, snapshot] = await Promise.all([
      outboxSentCount(window.currentFrom, window.generatedAt),
      // Hai ảnh chụp trong MỘT groupBy (cùng bảng, cùng shape — nếp gộp của
      // `paidBookingsSlice`): card phải khớp ĐÚNG số hàng của
      // `/outbox?status=PENDING` và `?status=FAILED`.
      prisma.outbox.groupBy({
        by: ['status'],
        where: { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
        _count: { _all: true },
      }),
    ]);
    const countOf = (status: OutboxStatus) =>
      snapshot.find((group) => group.status === status)?._count._all ?? 0;

    return {
      period: statsPeriod(window),
      sent,
      queued: countOf(OutboxStatus.PENDING),
      failed: countOf(OutboxStatus.FAILED),
    };
  }

  /** Bộ số vùng `/payment-events` (F8) — hai lát kỳ + một count ảnh chụp, song song. */
  async adminPaymentEvents(): Promise<AdminPaymentEventsStats> {
    const now = new Date();
    const window = statsWindow(now);
    const stuckBefore = new Date(now.getTime() - PAYMENT_EVENT_STUCK_MINUTES * 60_000);
    const [current, previous, unprocessed, stuck] = await Promise.all([
      paymentEventsSlice(window.currentFrom, window.generatedAt),
      paymentEventsSlice(window.previousFrom, window.currentFrom),
      // Ảnh chụp đọc thẳng trạng thái: card phải khớp ĐÚNG số hàng của
      // `/payment-events?unprocessed=true`, kể cả row rất cũ.
      prisma.paymentEvent.count({ where: { processedAt: null } }),
      // "Kẹt" = chưa xong VÀ đã nhận từ trước ngưỡng — xem JSDoc lớp.
      prisma.paymentEvent.count({
        where: { processedAt: null, receivedAt: { lt: stuckBefore } },
      }),
    ]);

    return {
      period: statsPeriod(window),
      received: { current: current.received, previous: previous.received },
      unprocessed,
      stuck,
      linked: { current: current.linked, previous: previous.linked },
    };
  }

  /** Bộ số vùng `/enquiries` (F9) — hai lát kỳ + một count ảnh chụp, song song. */
  async adminEnquiries(): Promise<AdminEnquiriesStats> {
    const window = statsWindow(new Date());
    const [createdNow, createdBefore, wonNow, wonBefore, open] = await Promise.all([
      enquiriesCreatedCount(window.currentFrom, window.generatedAt),
      enquiriesCreatedCount(window.previousFrom, window.currentFrom),
      enquiryWonCount(window.currentFrom, window.generatedAt),
      enquiryWonCount(window.previousFrom, window.currentFrom),
      // Ảnh chụp đọc thẳng trạng thái: card phải khớp ĐÚNG tổng số hàng của
      // ba tab NEW/CONTACTED/QUOTED trên chính trang đó.
      prisma.enquiry.count({ where: { status: { in: [...OPEN_ENQUIRY_STATUSES] } } }),
    ]);

    return {
      period: statsPeriod(window),
      created: { current: createdNow, previous: createdBefore },
      won: { current: wonNow, previous: wonBefore },
      open,
    };
  }

  /** Bộ số vùng `/subscribers` (F10) — hai lát kỳ + một count ảnh chụp, song song. */
  async adminSubscribers(): Promise<AdminSubscribersStats> {
    const window = statsWindow(new Date());
    // MỘT câu cho cả năm con số (vòng vá review F10); `active` là ảnh chụp
    // toàn bảng — khớp ĐÚNG số hàng của `/subscribers?active=true` khi không
    // có bộ lọc nào khác.
    const stats = await subscribersStats(window);
    return { period: statsPeriod(window), ...stats };
  }

  /**
   * Hàng đợi cancellation ĐANG MỞ tại mốc `at` — dựng lại từ dấu vết thời
   * gian: đã mở trước mốc đó, và tới mốc đó chưa ai quyết. `decidedAt: null`
   * là các request còn sống; `decidedAt >= at` là các request bấy giờ còn mở
   * nhưng đã được quyết sau đó.
   */
  private pendingRequestsAt(at: Date): Promise<number> {
    return prisma.cancellationRequest.count({
      where: {
        createdAt: { lt: at },
        OR: [{ decidedAt: null }, { decidedAt: { gte: at } }],
      },
    });
  }

  /**
   * Hàng đợi moderation tại mốc `at`. KHÔNG dựng lại được bằng riêng dấu thời
   * gian như cancellations: ở đó `decided_at` được ghi ĐÚNG KHI có quyết
   * định, còn `moderated_at` null chỉ nghĩa là "chưa ai bấm nút" — mà một
   * review có thể ra đời ĐÃ DUYỆT SẴN (seed dựng 84 testimonial CURATED với
   * `is_approved = true`, `moderated_at` null). Bản đầu của F5 chỉ nhìn
   * `moderated_at` nên đếm cả 84 cái đó là hàng đợi của 28 ngày trước, và
   * card `/reviews` vẽ một cú "dọn sạch hàng đợi" hoàn toàn bịa.
   *
   * Nên trạng thái tại mốc suy từ `is_approved` CỘNG với lúc quyết định gần
   * nhất rơi vào đâu:
   * - quyết định gần nhất TRƯỚC mốc (hoặc chưa từng có) ⇒ trạng thái tại mốc
   *   chính là trạng thái bây giờ → đang chờ khi và chỉ khi giờ vẫn chưa duyệt;
   * - quyết định gần nhất SAU mốc ⇒ tại mốc nó chưa mang kết quả đó; đang
   *   duyệt bây giờ ⇒ lúc ấy còn chờ.
   *
   * Vẫn là XẤP XỈ ở đúng một ca: review bị moderate NHIỀU LẦN sau mốc (duyệt
   * rồi gỡ) — `moderated_at` chỉ giữ lần cuối. `review_moderation_events` có
   * đủ lịch sử nếu ngày nào cần chính xác tuyệt đối.
   */
  private pendingReviewsAt(at: Date): Promise<number> {
    return prisma.review.count({
      where: {
        createdAt: { lt: at },
        OR: [
          { isApproved: false, OR: [{ moderatedAt: null }, { moderatedAt: { lt: at } }] },
          { isApproved: true, moderatedAt: { gte: at } },
        ],
      },
    });
  }

  /** Hai con số review của MỘT kỳ `[from, to)`. */
  private async reviewsSlice(from: Date, to: Date) {
    const [approved, submitted] = await Promise.all([
      // Đếm LƯỢT duyệt trên audit trail, không đếm trạng thái hiện tại —
      // un-approve về sau không được xoá ngược lịch sử (định nghĩa đầu file).
      reviewApprovals(from, to),
      prisma.review.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _avg: { rating: true },
      }),
    ]);
    return { approved, rating: average(submitted._avg.rating) };
  }
}
