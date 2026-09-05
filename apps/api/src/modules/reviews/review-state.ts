import type { ReviewModerationState } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Trạng thái moderation của một review — logic THUẦN, nguồn DUY NHẤT
 * (ADR-0031 §1).
 *
 * Tách khỏi `reviews.service.ts` ở vòng 05/09 vì `stats.service.ts` cũng phải
 * biết luật này: bốn card `/reviews` đều lọc theo trạng thái, và một bản chép
 * thứ hai của phép suy "hai cột → ba trạng thái" là một bản sẽ trôi lệch. Ở
 * đây thì cả hai module đọc cùng một chỗ, và nó test được mà không cần DB.
 */

/**
 * Hai cột → MỘT trạng thái. Mỗi nơi tự ghép `isApproved` với `rejectedAt` là
 * một nơi có thể ghép sai, và cái sai ấy im lặng (một review bị bác hiện ra
 * như đang chờ duyệt).
 *
 * Ca "vừa đăng vừa bị bác" không cần xử ở đây — CHECK `reviews_verdict_shape`
 * của DB không cho nó tồn tại.
 */
export function reviewModerationState(row: {
  isApproved: boolean;
  rejectedAt: Date | null;
}): ReviewModerationState {
  if (row.isApproved) return 'approved';
  return row.rejectedAt ? 'rejected' : 'pending';
}

/**
 * Ba trạng thái → mệnh đề `where`, khai MỘT chỗ.
 *
 * `pending` là chỗ dễ sai nhất và cũng là lý do ADR-0031 tồn tại: nó KHÔNG
 * phải "chưa đăng" mà là "chưa có phán quyết" — thiếu `rejectedAt: null` thì
 * hàng đợi lại nuốt cả những review đã bị bác.
 */
export const REVIEW_STATE_WHERE: Record<ReviewModerationState, Prisma.ReviewWhereInput> = {
  pending: { isApproved: false, rejectedAt: null },
  approved: { isApproved: true },
  // `isApproved: false` KHÔNG thừa: CHECK `reviews_verdict_shape` đã bảo đảm
  // bị bác ⇒ không đăng, nhưng planner không suy được điều đó — thiếu vế này
  // tab Rejected không khớp prefix index `(is_approved, rejected_at, …)` và
  // rơi về seq scan + sort (vòng vá review 05/09).
  rejected: { isApproved: false, rejectedAt: { not: null } },
};

/**
 * Review CHƯA bị bác — dùng cho mọi phép đo Ý KIẾN của khách.
 *
 * Vì sao cần một hằng riêng thay vì lọc tại chỗ: `averageRating` đo *khách nói
 * gì*, mà một review đã bị bác là nội dung ta đã phán quyết KHÔNG phải ý kiến
 * thật (spam, quảng cáo, không nói về chuyến đi). Để nó trong phép trung bình
 * thì một review 1 sao spam kéo tụt con số dù không ai đăng nó lên.
 *
 * ⚠️ CỐ Ý không dùng cho `submitted`. Hai card đo hai thứ khác nhau:
 * `submitted` đo KHỐI LƯỢNG VIỆC (một review bị bác vẫn là một review có
 * người phải đọc), còn `averageRating` đo Ý KIẾN. Bắt chúng chung một tập là
 * chỗ sai của bản đầu — xem ADR-0028 §AMEND 2 §4 và AMEND 05/09 của nó.
 *
 * Và KHÁC hẳn việc lọc theo `isApproved`: một review đang chờ duyệt vẫn là ý
 * kiến thật của khách, chỉ là chưa ai kịp đọc. Lọc theo trạng thái duyệt sẽ
 * làm một hàng đợi tồn đọng tự bóp méo con số mà chẳng khách nào đổi ý.
 */
export const NOT_REJECTED: Prisma.ReviewWhereInput = { rejectedAt: null };
