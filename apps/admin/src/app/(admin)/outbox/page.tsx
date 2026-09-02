import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { StatCardRow } from '@/components/kit/stat-card';
import { OutboxTable } from '@/components/outbox/outbox-table';
import { fetchAdminOutbox } from '@/lib/api/outbox';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminOutboxStats } from '@/lib/api/stats';
import { outboxHref, parseOutboxSearchParams } from '@/lib/outbox-query';
import { toOutboxRowVM } from '@/lib/outbox-view';
import { toOutboxStatCards } from '@/lib/stats-view';
import type { RawSearchParams } from '@/lib/table-query';
import { retryOutboxAction } from './actions';

/**
 * `/outbox` — hàng đợi email của worker (spec P4c §3-F7).
 *
 * Server component đúng nếp `/cancellations` (spec P4b §2.2): `searchParams`
 * (page/status/type/q) → input contract → fetch oRPC kèm cookie forward →
 * truyền một trang đã format xuống bảng client. Hàng stat card fetch CÙNG ĐỢT
 * với list. Server action `retryOutboxAction` truyền xuống như một prop.
 */
export const metadata: Metadata = {
  title: 'Outbox — Nexora back office',
};

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseOutboxSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminOutbox(cookie, query),
    fetchAdminOutboxStats(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  // Page mồ côi: tab FAILED co lại sau mỗi retry (và purge dọn SENT) — đưa về
  // trang cuối còn thật thay vì bảng rỗng cạnh thanh phân trang nói ngược lại.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(outboxHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toOutboxStatCards(stats)} />
      <OutboxTable
        rows={paged.items.map(toOutboxRowVM)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        retry={retryOutboxAction}
      />
    </AdminShell>
  );
}
