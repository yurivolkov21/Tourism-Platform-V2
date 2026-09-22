import { vietnamToday } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ChevronLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { DeparturesTable } from '@/components/departures/departures-table';
import { fetchAdminDepartures } from '@/lib/api/departures';
import { getServerSession } from '@/lib/api/session';
import { formatAmount } from '@/lib/bookings-view';
import {
  departuresHref,
  parseDeparturesSearchParams,
  TOURS_LIST_HREF,
} from '@/lib/departures-query';
import { toDepartureRowVM } from '@/lib/departures-view';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { createDepartureAction, setDepartureStatusAction, updateDepartureAction } from './actions';

/**
 * `/tours/[slug]/departures` — lịch chạy của MỘT tour (spec P4e-1 F12).
 *
 * Server component đúng nếp `/enquiries`: `searchParams` → input contract →
 * fetch oRPC kèm cookie forward → truyền một trang đã format xuống bảng
 * client. `slug` đến từ ĐOẠN ĐƯỜNG DẪN, không phải query.
 *
 * Trang này chở cả ba server action xuống bảng (thay vì để component tự
 * import): bảng và dialog test được với hàm giả, không phải mock
 * `next/headers`.
 */
const t = messages.admin.departures;

/**
 * Tiêu đề tab CỐ ĐỊNH: lấy tên tour sẽ phải chờ chính request đang fetch, và
 * `generateMetadata` là một lượt đọc thứ hai cho đúng một chuỗi.
 */
export const metadata: Metadata = {
  title: 'Departures — Nexora back office',
};

export default async function DeparturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const query = parseDeparturesSearchParams(slug, await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged] = await Promise.all([
    getServerSession(),
    fetchAdminDepartures(cookie, query),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;
  // Slug rác trên đường dẫn là `notFound()` của Next, không phải màn lỗi chung.
  if (!paged) notFound();

  // Trang mồ côi: bộ lọc co lại (đóng hết chuyến OPEN chẳng hạn) trong khi URL
  // vẫn trỏ trang cũ.
  const orphan = orphanPageHref(paged, query, (page) => departuresHref(query, { page }));
  if (orphan) redirect(orphan);

  // "Hôm nay" theo giờ VIỆT NAM, tính một lần ở SERVER và đưa xuống: hạn chót
  // là luật tiền (ADR-0041 §7), đồng hồ trình duyệt không được quyết nút nào
  // sáng nút nào tối.
  const today = vietnamToday(new Date());

  return (
    <AdminShell user={session}>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Link
          href={TOURS_LIST_HREF}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ChevronLeftIcon className="size-4" />
          {t.list.back}
        </Link>

        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.list.heading(paged.tour.title)}
          </h2>
          <p className="text-sm text-muted-foreground">{t.list.subtitle}</p>
        </div>
      </div>

      <DeparturesTable
        rows={paged.items.map((row) => toDepartureRowVM(row, today))}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        tour={{
          slug: paged.tour.slug,
          basePriceLabel: formatAmount(paged.tour.basePrice, paged.tour.currency),
        }}
        today={today}
        create={createDepartureAction}
        update={updateDepartureAction}
        setStatus={setDepartureStatusAction}
      />
    </AdminShell>
  );
}
