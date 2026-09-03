import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { StatCardRow } from '@/components/kit/stat-card';
import { SubscribersTable } from '@/components/subscribers/subscribers-table';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminSubscribersStats } from '@/lib/api/stats';
import { fetchAdminSubscribers } from '@/lib/api/subscribers';
import { toSubscribersStatCards } from '@/lib/stats-view';
import { parseSubscribersSearchParams, subscribersHref } from '@/lib/subscribers-query';
import { toSubscriberRowVM } from '@/lib/subscribers-view';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { unsubscribeSubscriberAction } from './actions';

/**
 * `/subscribers` — danh sách nhận tin của form footer web (spec P4c §3-F10).
 *
 * Server component đúng nếp `/outbox`/`/enquiries` (spec P4b §2.2):
 * `searchParams` (page/active/q/source) → input contract → fetch oRPC kèm
 * cookie forward → truyền một trang đã format xuống bảng client. Hàng stat
 * card fetch CÙNG ĐỢT với list. Server action `unsubscribeSubscriberAction`
 * truyền xuống như một prop.
 */
export const metadata: Metadata = {
  title: 'Subscribers — Nexora back office',
};

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseSubscribersSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminSubscribers(cookie, query),
    fetchAdminSubscribersStats(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  // Page mồ côi: tab Active co lại sau mỗi lần gỡ một địa chỉ — đưa về trang
  // cuối còn thật thay vì bảng rỗng cạnh thanh phân trang nói ngược lại.
  const orphan = orphanPageHref(paged, query, (page) => subscribersHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toSubscribersStatCards(stats)} />
      <SubscribersTable
        rows={paged.items.map(toSubscriberRowVM)}
        query={query}
        // Nguồn của Select lọc — distinct toàn bảng, do chính response mang về.
        sources={paged.sources}
        total={paged.total}
        totalPages={paged.totalPages}
        unsubscribe={unsubscribeSubscriberAction}
      />
    </AdminShell>
  );
}
