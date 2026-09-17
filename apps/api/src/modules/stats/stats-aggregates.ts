import { isWithinDeadline } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EnquiryStatus,
  OutboxStatus,
} from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import type { DayRow } from './stats-math.js';

/**
 * Các câu AGGREGATE dùng chung của bề mặt số liệu admin — một khoảng
 * `[from, to)` vào, một nhúm số ra. Tách ra ở F6 (spec P4b §3-F6) khi báo cáo
 * tháng trở thành người tiêu thụ THỨ HAI của cùng những định nghĩa mà stat
 * card 28 ngày đang dùng.
 *
 * Vì sao phải tách thay vì để báo cáo tự viết lại câu query của nó: "doanh thu"
 * chỉ được có MỘT định nghĩa (neo `paid_at`, gross). Hai bản chép sẽ trôi lệch
 * và ngày ấy stat card với báo cáo tháng nói hai con số khác nhau về cùng một
 * tuần — không ai biết cái nào đúng.
 *
 * Định nghĩa TỪNG metric (đọc kỹ trước khi sửa) vẫn nằm ở JSDoc `StatsService`:
 * đây chỉ là các câu query, không phải nơi kể chuyện.
 *
 * Mọi khoảng đều NỬA-MỞ `gte … lt` nên hai kỳ liền kề không đếm chung row nào.
 */

/**
 * Ba con số của tập ĐÃ TRẢ TIỀN trong khoảng: doanh thu + đếm + tử số tỉ lệ
 * huỷ. MỘT `groupBy` theo status trả cả ba (gộp ở vòng vá review F5).
 *
 * Chỉ đụng `paid_at` — phần "tạo trong khoảng" là câu hỏi khác và có hàm
 * riêng, vì hai consumer cần nó ở hai hình dạng khác nhau
 * (`bookingsCreatedCount` cho stat card, `bookingsCreatedByStatus` cho báo
 * cáo tháng).
 */
export async function paidBookingsSlice(from: Date, to: Date) {
  const byStatus = await prisma.booking.groupBy({
    by: ['status'],
    where: { paidAt: { gte: from, lt: to } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  let revenue: Prisma.Decimal | null = null;
  let paid = 0;
  let cancelledOfPaid = 0;
  for (const group of byStatus) {
    if (group._sum.totalAmount) {
      revenue = revenue ? revenue.add(group._sum.totalAmount) : group._sum.totalAmount;
    }
    paid += group._count._all;
    // CANCELLED (huỷ qua queue) + REFUNDED (hoàn đủ qua refund trực tiếp —
    // không bao giờ đụng CANCELLED) — xem định nghĩa ở StatsService.
    if (group.status === BookingStatus.CANCELLED || group.status === BookingStatus.REFUNDED) {
      cancelledOfPaid += group._count._all;
    }
  }

  return { revenue, paid, cancelledOfPaid };
}

/** Số booking TẠO trong khoảng, mọi trạng thái — stat card chỉ cần con số. */
export function bookingsCreatedCount(from: Date, to: Date): Promise<number> {
  return prisma.booking.count({ where: { createdAt: { gte: from, lt: to } } });
}

/**
 * Phân rã lứa booking TẠO trong khoảng theo trạng thái HIỆN TẠI của chúng —
 * chỉ báo cáo tháng cần (stat card không có ô nào cho nó).
 *
 * Trả về Map thưa (chỉ trạng thái có row); phần điền 0 cho đủ enum là việc
 * của tầng dựng response, vì chính contract mới là chỗ hứa "đủ mọi trạng thái".
 *
 * Báo cáo tháng lấy LUÔN `newBookings` từ tổng của map này thay vì gọi thêm
 * `bookingsCreatedCount` (vòng vá review F6): hai query riêng chụp hai
 * khoảnh khắc hơi khác nhau, nên một booking sinh ra ở giữa sẽ làm bảng in
 * năm hàng cộng lại một đằng còn hàng Total một nẻo — đúng cột mà người đọc
 * dùng để kiểm chéo.
 */
export async function bookingsCreatedByStatus(
  from: Date,
  to: Date,
): Promise<Map<BookingStatus, number>> {
  const groups = await prisma.booking.groupBy({
    by: ['status'],
    where: { createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.status, group._count._all]));
}

/**
 * Đồng tiền của các booking vừa được cộng — đọc từ booking trả tiền GẦN NHẤT
 * trong ĐÚNG khoảng `[from, to)` (chặn cả hai đầu, vòng vá review F5: thiếu
 * `lt` thì một row `paid_at` tương lai quyết đồng tiền cho một tổng nó không
 * góp đồng nào).
 *
 * Trả `null` khi khoảng không có booking nào — KHÔNG tự rơi về 'USD' (vòng vá
 * review F6): consumer mới biết nó còn nguồn nào khác để hỏi trước khi đành
 * dùng mặc định. Báo cáo tháng dán nhãn cả `refundedTotal`, mà tháng có hoàn
 * tiền nhưng không có payment là chuyện bình thường (hoàn cho booking trả
 * tiền tháng trước) — fallback 'USD' ở đây từng dán nhãn đô cho tiền EUR.
 */
export async function revenueCurrency(from: Date, to: Date): Promise<string | null> {
  const latest = await prisma.booking.findFirst({
    where: { paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: 'desc' },
    select: { currency: true },
  });
  return latest?.currency ?? null;
}

/**
 * Đồng tiền của các dòng HOÀN trong khoảng — đọc từ dòng hoàn gần nhất (sổ
 * cái `refunds` mang cột `currency` riêng, chép từ booking lúc hoàn). Nguồn
 * dự phòng cho nhãn tiền của báo cáo tháng khi kỳ không có payment nào; cùng
 * giới hạn đã ghi ở `grossAmount`: nền tảng hiện một-đồng-tiền, ngày có đồng
 * thứ hai trong CÙNG một kỳ thì tổng phải group theo currency chứ không chỉ
 * đổi nhãn.
 */
export async function refundCurrency(from: Date, to: Date): Promise<string | null> {
  const latest = await prisma.refund.findFirst({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'desc' },
    select: { currency: true },
  });
  return latest?.currency ?? null;
}

/**
 * Hai bộ đếm huỷ của MỘT khoảng (Hợp đồng D, ADR-0041 §9).
 *
 * Tập đếm là các yêu cầu `REFUNDED` có `decided_at` trong `[from, to)` — mỗi
 * lần khách huỷ ghi đúng một dòng như vậy. Mỗi dòng được xếp loại trong hay
 * quá hạn chót.
 *
 * Xếp loại ở NODE bằng `isWithinDeadline` của contract chứ không trong SQL:
 * luật N chỉ sống ở một chỗ (spec §4.1). Mốc đem so là `created_at` của yêu
 * cầu, tức lúc khách bấm huỷ, trên ngày đi, ngày về SNAPSHOT của booking. Dòng
 * `REQUESTED`/`DENIED` của luồng duyệt cũ không huỷ booking nào nên không đếm.
 *
 * Kéo từng dòng về thay vì `groupBy`: một tháng chỉ vài chục lần huỷ, và
 * `select` chỉ ba cột.
 */
export async function cancellationOutcomesSlice(
  from: Date,
  to: Date,
): Promise<{ withinDeadline: number; afterDeadline: number }> {
  const rows = await prisma.cancellationRequest.findMany({
    where: {
      status: CancellationRequestStatus.REFUNDED,
      decidedAt: { gte: from, lt: to },
    },
    select: {
      createdAt: true,
      booking: { select: { departureStartDate: true, departureEndDate: true } },
    },
  });

  let withinDeadline = 0;
  for (const row of rows) {
    const within = isWithinDeadline(
      row.createdAt,
      calendarDate(row.booking.departureStartDate),
      calendarDate(row.booking.departureEndDate),
    );
    if (within) withinDeadline += 1;
  }
  return { withinDeadline, afterDeadline: rows.length - withinDeadline };
}

/**
 * SỐ LƯỢT duyệt review trong khoảng — đếm trên audit trail
 * `review_moderation_events`, KHÔNG trên trạng thái hiện tại của review: một
 * cú un-approve hôm nay không được phép xoá ngược lượt duyệt khỏi một kỳ đã
 * đóng (vòng vá review F5).
 */
export function reviewApprovals(from: Date, to: Date): Promise<number> {
  return prisma.reviewModerationEvent.count({
    where: { toApproved: true, createdAt: { gte: from, lt: to } },
  });
}

/**
 * Tiền HOÀN trong khoảng — tổng + số lượt trên sổ cái `refunds` (ADR-0009),
 * theo `created_at` của chính dòng hoàn. Chỉ báo cáo tháng cần.
 *
 * Đây là dòng tiền ĐI RA của kỳ, KHÔNG phải một phép hiệu chỉnh doanh thu:
 * một dòng hoàn tháng này có thể thuộc booking đã trả tiền từ tháng trước, và
 * `revenue` thì cố ý để gross.
 */
export async function refundsSlice(from: Date, to: Date) {
  const result = await prisma.refund.aggregate({
    where: { createdAt: { gte: from, lt: to } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { total: result._sum.amount, count: result._count._all };
}

/**
 * Email đã GIAO trong khoảng — đếm row `SENT` theo `processedAt` (F7, spec
 * P4c §3-F7). Neo `processedAt` chứ không `createdAt`: hàng xếp từ tuần trước
 * mà mãi hôm nay mới đi (sau khi admin retry) là email của hôm nay. Lọc
 * `SENT` là ĐIỀU KIỆN THẬT chứ không phải trang trí (vòng vá review F7): row
 * `SKIPPED` cũng có `processedAt` — worker cố ý không gửi vì người nhận đã
 * huỷ đăng ký — và không được đếm vào "đã giao".
 */
export function outboxSentCount(from: Date, to: Date): Promise<number> {
  return prisma.outbox.count({
    where: { status: OutboxStatus.SENT, processedAt: { gte: from, lt: to } },
  });
}

/**
 * Webhook đã NHẬN trong khoảng (theo `receivedAt`) và bao nhiêu trong đó gắn
 * được booking (`bookingId` not null) — F8, spec P4c §3-F8. MỘT `aggregate`
 * trả cả hai (vòng vá review F8): `_count.<cột>` của Prisma đếm row có cột
 * đó KHÁC null — đúng nghĩa "gắn booking" — nên không cần lượt đếm thứ hai
 * với `bookingId: { not: null }`, và hai con số chụp cùng một khoảnh khắc.
 */
export async function paymentEventsSlice(from: Date, to: Date) {
  const result = await prisma.paymentEvent.aggregate({
    where: { receivedAt: { gte: from, lt: to } },
    _count: { _all: true, bookingId: true },
  });
  return { received: result._count._all, linked: result._count.bookingId };
}

/**
 * Lead GỬI trong khoảng (theo `createdAt`), MỌI trạng thái — F9, spec P4c
 * §3-F9. KHÔNG lọc `status = NEW`: card đọc là "New 28d" nhưng nó là "mới
 * đến trong kỳ", còn một lead gửi hôm kia mà hôm nay đã WON vẫn là lead mới
 * của kỳ (xem JSDoc field `created` ở contract).
 */
export function enquiriesCreatedCount(from: Date, to: Date): Promise<number> {
  return prisma.enquiry.count({ where: { createdAt: { gte: from, lt: to } } });
}

/**
 * Số LEAD có ít nhất một lượt chuyển sang WON trong khoảng — đếm
 * `DISTINCT enquiry_id` trên audit trail `enquiry_status_events` theo
 * `created_at` của EVENT, KHÔNG trên `enquiries.status`/`updated_at` (spec
 * §2.5, đúng bài học `reviewApprovals` ở F5): một lead thắng tuần này rồi mất
 * lại tuần sau vẫn phải giữ nguyên con số của kỳ đã đóng — trạng thái hiện
 * tại thì không kể được chuyện đó.
 *
 * DISTINCT (vòng vá review F9): chuyển tự do năm trạng thái nên "bấm nhầm WON
 * → sửa LOST → WON thật" là hai event của MỘT lead; card "Won 28d" đứng cạnh
 * "New 28d" (đếm lead) nên cũng phải đếm lead, không đếm lượt bấm. Prisma
 * `count` không có DISTINCT trên cột → một câu SQL, index `[to_status,
 * created_at]` vẫn phủ được vế WHERE.
 */
export async function enquiryWonCount(from: Date, to: Date): Promise<number> {
  const [row] = await prisma.$queryRaw<{ won: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT enquiry_id) AS won
    FROM enquiry_status_events
    WHERE to_status = ${EnquiryStatus.WON}::"EnquiryStatus"
      AND created_at >= ${from} AND created_at < ${to}
  `);
  return Number(row?.won ?? 0);
}

/**
 * Cả NĂM con số của danh sách nhận tin trong MỘT lượt quét — F10, spec P4c
 * §3-F10 (vòng vá review F10: bản đầu là 5 `COUNT(*)` rời, tức 5 seq scan
 * trên một bảng không index ở mỗi lần render vì vùng này không cache).
 * `COUNT(*) FILTER (WHERE …)` cho mỗi vế — Prisma `aggregate` không diễn đạt
 * được nhiều vế WHERE khác nhau, nên đi đường raw SQL như `enquiryWonCount`.
 * Bonus: năm con số chụp cùng một khoảnh khắc thay vì năm snapshot lệch nhau.
 *
 * Hai metric kỳ neo HAI cột khác nhau: `created_at` (lượt đăng ký) và
 * `unsubscribed_at` (lượt rút consent). Một hàng đăng ký RỒI huỷ trong cùng
 * một kỳ được đếm vào CẢ HAI, đúng như nó đã xảy ra hai lần. `active` là ảnh
 * chụp `unsubscribed_at IS NULL` toàn bảng — KHÔNG theo bộ lọc nào của trang.
 *
 * ⚠️ `unsubscribed` KHÔNG bất động: `resubscribe` (khách bấm link HMAC trong
 * email của chính họ) đặt `unsubscribed_at` về null, và lượt huỷ ấy biến khỏi
 * kỳ đã đóng. Không chữa được ở đây — xem JSDoc `AdminSubscribersStatsSchema`
 * ở contract cho lý do đầy đủ và việc phải làm nếu ngày nào cần con số bất
 * động (một bảng audit consent, cùng bài học F5/F9).
 */
export async function subscribersStats(window: {
  previousFrom: Date;
  currentFrom: Date;
  generatedAt: Date;
}) {
  const { previousFrom, currentFrom, generatedAt } = window;
  const [row] = await prisma.$queryRaw<
    {
      created_current: bigint;
      created_previous: bigint;
      unsubscribed_current: bigint;
      unsubscribed_previous: bigint;
      active: bigint;
    }[]
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= ${currentFrom} AND created_at < ${generatedAt}) AS created_current,
      COUNT(*) FILTER (WHERE created_at >= ${previousFrom} AND created_at < ${currentFrom}) AS created_previous,
      COUNT(*) FILTER (WHERE unsubscribed_at >= ${currentFrom} AND unsubscribed_at < ${generatedAt}) AS unsubscribed_current,
      COUNT(*) FILTER (WHERE unsubscribed_at >= ${previousFrom} AND unsubscribed_at < ${currentFrom}) AS unsubscribed_previous,
      COUNT(*) FILTER (WHERE unsubscribed_at IS NULL) AS active
    FROM subscribers
  `);
  return {
    created: {
      current: Number(row?.created_current ?? 0),
      previous: Number(row?.created_previous ?? 0),
    },
    unsubscribed: {
      current: Number(row?.unsubscribed_current ?? 0),
      previous: Number(row?.unsubscribed_previous ?? 0),
    },
    active: Number(row?.active ?? 0),
  };
}

/**
 * Cột KẾT QUẢ KINH DOANH của báo cáo (ADR-0033 §1) — neo `departure_end_date`,
 * tức những chuyến KẾT THÚC trong kỳ, chứ không phải tiền vào trong kỳ.
 *
 * Hai tập, định nghĩa ở ADR-0041 §9 (sửa ADR-0033 §4):
 * - **Doanh thu**: MỌI booking đã trả tiền (`paid_at IS NOT NULL`), kể cả booking
 *   khách đã huỷ — tiền giữ lại của lần huỷ quá hạn là doanh thu, còn lần huỷ
 *   trong hạn đã hoàn trọn nên tự góp 0.
 * - **Khách thực đi** (cờ `travelled`): đã trả tiền VÀ trạng thái khác CANCELLED
 *   — gồm cả REFUNDED do hoàn thiện chí toàn bộ mà vẫn đi. Giá vốn biến đổi và
 *   `cost_missing` chỉ đếm tập này: khách huỷ không ăn suất ăn nào. Chi phí CỐ
 *   ĐỊNH ở `fixedCostSlice`.
 * - **Phí cổng** (`gross_collected`, `bookings`) tính trên tập DOANH THU: cổng
 *   thu phí lúc thanh toán và không trả lại khi hoàn hay huỷ (ADR-0033 §Giới
 *   hạn #3), nên booking đã huỷ vẫn phát sinh phí.
 *
 * MỘT câu SQL trả sáu con số vì chúng phải chụp CÙNG một khoảnh khắc: các câu
 * rời sẽ cho `costMissing` thuộc một tập booking còn `revenue` thuộc tập khác
 * (cùng bài học đã ghi ở `subscribersStats`). CTE `paid` dựng cờ `travelled`
 * MỘT lần, nên định nghĩa "khách thực đi" không bị chép vào từng `FILTER`.
 *
 * `LEFT JOIN` gộp refund theo booking thay vì join thẳng bảng `refunds`: một
 * booking hoàn NHIỀU lần được, và join thẳng sẽ nhân `total_amount` theo số
 * dòng hoàn.
 *
 * Chuyến bị HUỶ không góp gì (ADR-0033 AMEND 1a): tiền khách đã trả cho chuyến
 * không chạy là tiền đang NỢ khách, không phải doanh thu. Cùng vế
 * `d.status <> CANCELLED` với `fixedCostSlice`, nên "chuyến đã chạy" chỉ có MỘT
 * định nghĩa trong cả kỳ.
 *
 * ⚠️ KHÔNG BẤT ĐỘNG theo kỳ (ADR-0033 *Giới hạn* #5): `refunded` gộp MỌI dòng
 * hoàn của booking không kể `created_at`, và `status` là trạng thái HIỆN TẠI.
 * Một khoản hoàn tháng 7 làm báo cáo tháng 5 đọc lại ra số khác. Chữa thật cần
 * cột snapshot theo kỳ — ghi nợ, chưa làm.
 */
export async function recognizedRevenueSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    {
      revenue: Prisma.Decimal | null;
      cogs_variable: Prisma.Decimal | null;
      gross_collected: Prisma.Decimal | null;
      bookings: bigint;
      cost_missing: bigint;
      currency: string | null;
    }[]
  >(Prisma.sql`
    WITH paid AS (
      SELECT b.total_amount - COALESCE(r.refunded, 0) AS kept,
             b.total_amount,
             b.cost_per_person,
             b.num_adults + b.num_children AS pax,
             b.currency,
             -- Khách thực đi (Hợp đồng D): đã trả tiền và không huỷ.
             b.status <> ${BookingStatus.CANCELLED}::"BookingStatus" AS travelled
      FROM bookings b
      JOIN tour_departures d ON d.id = b.departure_id
      LEFT JOIN (
        SELECT booking_id, SUM(amount) AS refunded FROM refunds GROUP BY booking_id
      ) r ON r.booking_id = b.id
      WHERE b.paid_at IS NOT NULL
        AND d.status <> ${DepartureStatus.CANCELLED}::"DepartureStatus"
        AND b.departure_end_date >= ${from} AND b.departure_end_date < ${to}
    )
    SELECT
      COALESCE(SUM(kept), 0) AS revenue,
      COALESCE(SUM(COALESCE(cost_per_person, 0) * pax) FILTER (WHERE travelled), 0)
        AS cogs_variable,
      COALESCE(SUM(total_amount), 0) AS gross_collected,
      COUNT(*) AS bookings,
      COUNT(*) FILTER (WHERE travelled AND cost_per_person IS NULL) AS cost_missing,
      -- Nhãn tiền của TẬP NÀY (nền tảng một-đồng-tiền, xem grossAmount):
      -- tháng không có payment/refund nào nhưng có chuyến chạy từng bị dán
      -- 'USD' mặc định lên cả khối P&L (vòng vá review 05/09).
      MAX(currency) AS currency
    FROM paid
  `);

  return {
    revenue: row?.revenue ?? new Prisma.Decimal(0),
    cogsVariable: row?.cogs_variable ?? new Prisma.Decimal(0),
    // Tiền GỐC của MỌI booking đã trả, trước khi trừ hoàn — phí cổng tính trên
    // số này, và provider không trả lại phí khi hoàn hay huỷ (ADR-0033 §Giới hạn #3).
    grossCollected: row?.gross_collected ?? new Prisma.Decimal(0),
    bookings: Number(row?.bookings ?? 0),
    costMissing: Number(row?.cost_missing ?? 0),
    currency: row?.currency ?? null,
  };
}

/**
 * Giá vốn CỐ ĐỊNH của các chuyến đã chạy trong kỳ (ADR-0033 §4) — cộng MỘT lần
 * cho mỗi chuyến, bất kể bán được bao nhiêu ghế. Xe vẫn chạy.
 *
 * "Đã chạy" phải có ĐỦ hai vế: chuyến không bị huỷ, VÀ có ít nhất một khách
 * THỰC ĐI — cùng tập `travelled` của `recognizedRevenueSlice` (đã trả tiền,
 * trạng thái khác CANCELLED; ADR-0041 §9). Thiếu vế `EXISTS` thì mọi chuyến ế
 * trong lịch đều bị tính tiền xe — một tour đăng 52 chuyến cả năm mà bán được
 * 6 sẽ báo lỗ nặng từ hư không. Chuyến mà mọi khách đều đã huỷ thì không chạy,
 * dù tiền giữ lại của họ vẫn vào doanh thu.
 */
export async function fixedCostSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    { total: Prisma.Decimal | null; departures: bigint; cost_missing: bigint }[]
  >(
    // `cost_missing` ĐẾM chuyến chưa khai giá vốn cố định thay vì để COALESCE
    // im lặng coi bằng 0 (ADR-0033 §3: "báo cáo phải nói ra là thiếu").
    Prisma.sql`
      SELECT COALESCE(SUM(d.fixed_cost_amount), 0) AS total, COUNT(*) AS departures,
             COUNT(*) FILTER (WHERE d.fixed_cost_amount IS NULL) AS cost_missing
      FROM tour_departures d
      WHERE d.status <> ${DepartureStatus.CANCELLED}::"DepartureStatus"
        AND d.end_date >= ${from} AND d.end_date < ${to}
        AND EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.departure_id = d.id
            AND b.paid_at IS NOT NULL
            AND b.status <> ${BookingStatus.CANCELLED}::"BookingStatus"
        )
    `,
  );

  return {
    total: row?.total ?? new Prisma.Decimal(0),
    departures: Number(row?.departures ?? 0),
    costMissing: Number(row?.cost_missing ?? 0),
  };
}

/**
 * Doanh thu + số đơn ĐÃ TRẢ TIỀN theo từng NGÀY trong `[from, to)` — nguồn
 * của biểu đồ dashboard (ADR-0036 §2). Cùng tập, cùng cột neo (`paid_at`,
 * gross) với `paidBookingsSlice`: cộng mọi hàng của một khoảng phải ra đúng
 * `revenue`/`paid` của slice cùng khoảng — đó là phép đối chứng.
 *
 * Raw SQL vì Prisma `groupBy` không group theo BIỂU THỨC (`date_trunc`), và
 * hai con số cùng một lượt quét chụp cùng một khoảnh khắc (cùng lý do
 * `subscribersStats`). `date_trunc('day', …)` trên cột `timestamp` không tz
 * mà mọi đường ghi đều UTC → ngày UTC, khớp `calendarDate()` bên response;
 * không `AT TIME ZONE` nào chen vào.
 *
 * Trả về THƯA (chỉ ngày có row) — điền 0 là việc của `fillDaySeries`. `day`
 * về từ driver là `Date` 00:00 UTC; `COUNT` là bigint nên ép `Number` ở đây.
 *
 * `currency` đi CÙNG lượt quét (ADR-0036 AMEND 2): bản đầu hỏi nhãn tiền bằng
 * một `findFirst` thứ hai trên cùng cửa sổ 90 ngày không index — vừa tốn một
 * lượt quét, vừa không cùng khoảnh khắc với chính chuỗi. `MAX(currency)` mỗi
 * ngày là đủ vì nền tảng một-đồng-tiền (cùng giới hạn `grossAmount`); ngày
 * nào có hai đồng thì `SUM` đã sai trước khi nhãn kịp sai.
 */
export async function paidByDay(from: Date, to: Date): Promise<DayRow[]> {
  const rows = await prisma.$queryRaw<
    { day: Date; revenue: Prisma.Decimal; bookings: bigint; currency: string | null }[]
  >(
    Prisma.sql`
      SELECT date_trunc('day', paid_at) AS day,
             SUM(total_amount)          AS revenue,
             COUNT(*)                   AS bookings,
             MAX(currency)              AS currency
      FROM bookings
      WHERE paid_at >= ${from} AND paid_at < ${to}
      GROUP BY 1
      ORDER BY 1
    `,
  );
  return rows.map((row) => ({
    day: row.day,
    revenue: row.revenue,
    bookings: Number(row.bookings),
    currency: row.currency,
  }));
}
