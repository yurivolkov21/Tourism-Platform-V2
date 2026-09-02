import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { StatCardRow } from '@/components/kit/stat-card';
import { PaymentEventsTable } from '@/components/payment-events/payment-events-table';
import { fetchAdminPaymentEvents } from '@/lib/api/payment-events';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminPaymentEventsStats } from '@/lib/api/stats';
import { parsePaymentEventsSearchParams, paymentEventsHref } from '@/lib/payment-events-query';
import { toPaymentEventRowVM } from '@/lib/payment-events-view';
import { toPaymentEventsStatCards } from '@/lib/stats-view';
import type { RawSearchParams } from '@/lib/table-query';
import { getPaymentEventAction } from './actions';

/**
 * `/payment-events` — sổ webhook Stripe/PayPal (spec P4c §3-F8), hoàn toàn đọc.
 *
 * Server component đúng nếp `/outbox` (spec P4b §2.2): `searchParams`
 * (page/provider/type/q/unprocessed) → input contract → fetch oRPC kèm cookie
 * forward → truyền một trang đã format xuống bảng client. Hàng stat card
 * fetch CÙNG ĐỢT với list. Server action đọc `getPaymentEventAction` truyền
 * xuống như một prop cho drawer.
 */
export const metadata: Metadata = {
  title: 'Payment events — Nexora back office',
};

export default async function PaymentEventsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parsePaymentEventsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged, stats] = await Promise.all([
    getServerSession(),
    fetchAdminPaymentEvents(cookie, query),
    fetchAdminPaymentEventsStats(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  // Page mồ côi: tập "Unprocessed only" co lại khi provider retry xong — đưa
  // về trang cuối còn thật thay vì bảng rỗng cạnh thanh phân trang nói ngược.
  if (paged.total > 0 && query.page > paged.totalPages) {
    redirect(paymentEventsHref(query, { page: paged.totalPages }));
  }

  return (
    <AdminShell user={session}>
      <StatCardRow cards={toPaymentEventsStatCards(stats)} />
      <PaymentEventsTable
        rows={paged.items.map(toPaymentEventRowVM)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        load={getPaymentEventAction}
      />
    </AdminShell>
  );
}
