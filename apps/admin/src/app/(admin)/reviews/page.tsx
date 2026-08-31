import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { ReviewsTable } from '@/components/reviews/reviews-table';
import { fetchAdminReviews } from '@/lib/api/reviews';
import { getServerSession } from '@/lib/api/session';
import { parseReviewsSearchParams, reviewsHref } from '@/lib/reviews-query';
import { toReviewRow } from '@/lib/reviews-view';
import type { RawSearchParams } from '@/lib/table-query';
import { moderateReviewAction } from './actions';

/**
 * `/reviews` — hàng đợi moderation (spec P4b §3-F4).
 *
 * Server component đúng nếp `/bookings` và `/cancellations` (§2.2):
 * `searchParams` (page/status/q) → input contract → fetch oRPC kèm cookie
 * forward → truyền một trang đã format xuống bảng client. Không có fetch nào
 * từ browser; đổi trang/lọc là điều hướng URL.
 *
 * Server action `moderateReviewAction` truyền xuống như một prop — client
 * component không tự import đường server nào (nếp F2).
 */
export const metadata: Metadata = {
  title: 'Reviews — Nexora back office',
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseReviewsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  // Session (chỉ để đổ vào nav-user — layout đã gác role) và trang dữ liệu là
  // hai request độc lập: chạy song song kẻo TTFB thành 2 RTT nối tiếp trên
  // MỌI click phân trang/lọc.
  const [session, paged] = await Promise.all([
    getServerSession(),
    fetchAdminReviews(cookie, query),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp hai trang kia).
  if (!session) return null;

  // Page mồ côi (review F3 31/08): tập kết quả CO LẠI sau mỗi lần duyệt khi
  // đang lọc theo trạng thái — admin đứng ở trang 3 của bộ lọc "Pending" mà
  // giờ chỉ còn 2 trang là bảng rỗng cạnh thanh phân trang nói ngược lại.
  // Đưa về trang cuối còn thật thay vì render nghịch lý.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(reviewsHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <ReviewsTable
        rows={paged.items.map(toReviewRow)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        moderate={moderateReviewAction}
      />
    </AdminShell>
  );
}
