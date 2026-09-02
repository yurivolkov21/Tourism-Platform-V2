import { Injectable } from '@nestjs/common';
import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminOutboxStats,
  AdminReviewsStats,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { CancellationRequestStatus, OutboxStatus } from '../../generated/prisma/enums.js';
import {
  bookingsCreatedCount,
  decisionsSlice,
  outboxSentCount,
  paidBookingsSlice,
  revenueCurrency,
  reviewApprovals,
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
 * **outbox** (F7, spec P4c §3-F7)
 * - `sent` — số row `SENT` có `processed_at` TRONG kỳ. Neo `processed_at`
 *   chứ không `created_at`: email xếp hàng tuần trước mà hôm nay mới đi (sau
 *   một cú retry) là email giao hôm nay. Query đối chứng:
 *   `SELECT COUNT(*) FROM outbox WHERE status = 'SENT' AND processed_at >= $from AND processed_at < $to`.
 *   ⚠️ Purge cron xoá row SENT cũ hơn 30 ngày (`OutboxService.purgeSent`),
 *   nên `previous` (kỳ 28–56 ngày trước) BỊ CẮT một phần bởi retention: con
 *   số kỳ trước là cận dưới, không phải sự thật đầy đủ. Vì vậy polarity
 *   card là NEUTRAL và caption vẫn ghi kỳ trước — đọc để lấy hướng, đừng so
 *   sổ. (Ngày nào retention đổi thì ghi chú này đổi theo.)
 * - `queued` — ẢNH CHỤP: số row `PENDING` ngay bây giờ, đúng bằng số hàng
 *   `/outbox?status=PENDING`. Không có "lúc đầu kỳ": trạng thái PENDING không
 *   để lại dấu thời gian nào khi rời đi, nên không dựng lại được — contract
 *   khai một số đơn thay vì bịa một cặp.
 * - `failed` — ẢNH CHỤP: số row `FAILED` ngay bây giờ (đúng bằng
 *   `/outbox?status=FAILED`). Đây là con số "cần người": hàng FAILED chỉ
 *   rời trạng thái đó khi admin retry.
 *
 * ## Index
 *
 * CỐ Ý chưa thêm index nào cho ba cột lọc mới (`bookings.paid_at`,
 * `cancellation_requests.decided_at`, `reviews.moderated_at`). Ở cỡ dữ liệu
 * hiện tại (hàng trăm row) seq scan rẻ hơn cả việc bảo trì index, và một
 * migration mới phải deploy tay lên Supabase dùng chung dev/prod. Ngưỡng để
 * xem lại: khi một trong ba bảng vượt ~10k row.
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

  /** Bộ số vùng `/outbox` (F7). */
  async adminOutbox(): Promise<AdminOutboxStats> {
    const window = statsWindow(new Date());
    const [sentNow, sentBefore, queued, failed] = await Promise.all([
      outboxSentCount(window.currentFrom, window.generatedAt),
      outboxSentCount(window.previousFrom, window.currentFrom),
      // Hai ảnh chụp đọc thẳng trạng thái: card phải khớp ĐÚNG số hàng của
      // `/outbox?status=PENDING` và `?status=FAILED`.
      prisma.outbox.count({ where: { status: OutboxStatus.PENDING } }),
      prisma.outbox.count({ where: { status: OutboxStatus.FAILED } }),
    ]);

    return {
      period: statsPeriod(window),
      sent: { current: sentNow, previous: sentBefore },
      queued,
      failed,
    };
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
