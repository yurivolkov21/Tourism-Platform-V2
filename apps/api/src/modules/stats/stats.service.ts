import { Injectable } from '@nestjs/common';
import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminReviewsStats,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { BookingStatus, CancellationRequestStatus } from '../../generated/prisma/enums.js';
import { average, money, ratePercent, statsPeriod, statsWindow } from './stats-math.js';

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
 *   điểm đọc đang ở `CANCELLED`. Mẫu số CHÍNH LÀ `paidBookings`, nên hai con
 *   số trên cùng hàng card kiểm chéo được nhau. Vì sao mẫu số là "đã trả
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
 * - `approved` — đếm theo `moderated_at` trong kỳ, `is_approved = true`.
 * - `averageRating` — `AVG(rating)` trên review GỬI trong kỳ (`created_at`),
 *   KHÔNG lọc theo trạng thái duyệt và KHÔNG lọc theo nguồn. Cố ý: lọc
 *   "đã duyệt" sẽ khiến một hàng đợi tồn đọng tự kéo tụt kỳ này so với kỳ
 *   trước dù không khách nào đổi ý. Đây KHÁC số sao trên trang tour (chỉ đếm
 *   review đã duyệt của tour đó — `Tour.ratingAvg`), và khác một cách có chủ
 *   đích. `null` khi kỳ không có review nào.
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
  /** Bộ số vùng `/bookings`. Mọi aggregate chạy song song — một RTT. */
  async adminBookings(): Promise<AdminBookingsStats> {
    const window = statsWindow(new Date());
    const [current, previous, currency] = await Promise.all([
      this.bookingsSlice(window.currentFrom, window.generatedAt),
      this.bookingsSlice(window.previousFrom, window.currentFrom),
      this.revenueCurrency(window.previousFrom),
    ]);

    return {
      period: statsPeriod(window),
      currency,
      revenue: { current: money(current.revenue), previous: money(previous.revenue) },
      paidBookings: { current: current.paid, previous: previous.paid },
      newBookings: { current: current.created, previous: previous.created },
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
      this.decisionsSlice(window.currentFrom, window.generatedAt),
      this.decisionsSlice(window.previousFrom, window.currentFrom),
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

  /**
   * Đồng tiền của các booking vừa được cộng — đọc từ booking trả tiền GẦN
   * NHẤT trong hai kỳ, rơi về 'USD' (mặc định cột `bookings.currency`) khi
   * hai kỳ trống trơn. Nền tảng là một-đồng-tiền nên câu này luôn có nghĩa;
   * xem cảnh báo group-by ở JSDoc field `currency` bên contract.
   */
  private async revenueCurrency(from: Date): Promise<string> {
    const latest = await prisma.booking.findFirst({
      where: { paidAt: { gte: from } },
      orderBy: { paidAt: 'desc' },
      select: { currency: true },
    });
    return latest?.currency ?? 'USD';
  }

  /** Ba con số booking của MỘT kỳ `[from, to)`. */
  private async bookingsSlice(from: Date, to: Date) {
    const paidInWindow = { paidAt: { gte: from, lt: to } };
    const [paid, created, cancelledOfPaid] = await Promise.all([
      prisma.booking.aggregate({
        where: paidInWindow,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.booking.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.booking.count({ where: { ...paidInWindow, status: BookingStatus.CANCELLED } }),
    ]);

    return {
      revenue: paid._sum.totalAmount,
      paid: paid._count._all,
      created,
      cancelledOfPaid,
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

  /** Hai con số quyết định của MỘT kỳ `[from, to)`. */
  private async decisionsSlice(from: Date, to: Date) {
    const decidedInWindow = { decidedAt: { gte: from, lt: to } };
    const [approved, denied] = await Promise.all([
      prisma.cancellationRequest.count({
        where: { ...decidedInWindow, status: CancellationRequestStatus.REFUNDED },
      }),
      prisma.cancellationRequest.count({
        where: { ...decidedInWindow, status: CancellationRequestStatus.DENIED },
      }),
    ]);
    return { approved, denied };
  }

  /** Hai con số review của MỘT kỳ `[from, to)`. */
  private async reviewsSlice(from: Date, to: Date) {
    const [approved, submitted] = await Promise.all([
      prisma.review.count({
        where: { isApproved: true, moderatedAt: { gte: from, lt: to } },
      }),
      prisma.review.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _avg: { rating: true },
      }),
    ]);
    return { approved, rating: average(submitted._avg.rating) };
  }
}
