import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, CancellationRequestStatus } from '../../generated/prisma/enums.js';

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

/** Ba con số booking của MỘT khoảng: doanh thu + đếm + tử số tỉ lệ huỷ. */
export async function bookingsSlice(from: Date, to: Date) {
  const [byStatus, created] = await Promise.all([
    // MỘT groupBy theo status trên tập đã-trả-tiền trả cả revenue + đếm + tử
    // số tỉ lệ huỷ (gộp ở vòng vá review F5), cộng một count theo createdAt.
    prisma.booking.groupBy({
      by: ['status'],
      where: { paidAt: { gte: from, lt: to } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.booking.count({ where: { createdAt: { gte: from, lt: to } } }),
  ]);

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

  return { revenue, paid, created, cancelledOfPaid };
}

/**
 * Phân rã lứa booking TẠO trong khoảng theo trạng thái HIỆN TẠI của chúng —
 * chỉ báo cáo tháng cần (stat card không có ô nào cho nó).
 *
 * Trả về Map thưa (chỉ trạng thái có row); phần điền 0 cho đủ enum là việc
 * của tầng dựng response, vì chính contract mới là chỗ hứa "đủ mọi trạng thái".
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
 * góp đồng nào). Rơi về 'USD' (mặc định cột `bookings.currency`) khi khoảng
 * không có booking nào.
 */
export async function revenueCurrency(from: Date, to: Date): Promise<string> {
  const latest = await prisma.booking.findFirst({
    where: { paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: 'desc' },
    select: { currency: true },
  });
  return latest?.currency ?? 'USD';
}

/** Hai con số quyết định cancellation của MỘT khoảng (theo `decidedAt`). */
export async function decisionsSlice(from: Date, to: Date) {
  const byStatus = await prisma.cancellationRequest.groupBy({
    by: ['status'],
    where: { decidedAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const countOf = (status: CancellationRequestStatus) =>
    byStatus.find((group) => group.status === status)?._count._all ?? 0;
  return {
    approved: countOf(CancellationRequestStatus.REFUNDED),
    denied: countOf(CancellationRequestStatus.DENIED),
  };
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
