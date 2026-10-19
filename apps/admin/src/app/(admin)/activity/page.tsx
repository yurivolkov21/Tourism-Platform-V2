import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ActivityTable } from '@/components/activity/activity-table';
import { AdminShell } from '@/components/admin-shell';
import { activityHref, parseActivitySearchParams } from '@/lib/activity-query';
import { toActivityRowVM } from '@/lib/activity-view';
import { requirePageAccess } from '@/lib/admin-access';
import { fetchAdminActivity } from '@/lib/api/activity';
import { getServerSession } from '@/lib/api/session';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';

/**
 * `/activity` — nhật ký thao tác admin (ADR-0061, spec 2026-10-19 §6). Server component đúng nếp
 * `/users`: `searchParams` → input contract → fetch kèm cookie forward → một trang đã nấu xuống
 * bảng. Chỉ Owner: chặn TRƯỚC khi gọi API.
 */
export const metadata: Metadata = {
  title: 'Activity — Nexora back office',
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseActivitySearchParams(await searchParams);
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  requirePageAccess(session, 'activity.list');

  const cookie = (await cookies()).toString();
  const paged = await fetchAdminActivity(cookie, query);
  // Trang mồ côi: URL trỏ quá trang cuối (gõ tay, hoặc lọc hẹp lại) — về trang cuối còn thật.
  const orphan = orphanPageHref(paged, query, (page) => activityHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <ActivityTable
        rows={paged.items.map(toActivityRowVM)}
        query={query}
        actors={paged.actors}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
