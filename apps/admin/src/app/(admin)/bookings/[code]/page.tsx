import type { CancellationRequest } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { ChevronLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { RefundPanel } from '@/components/bookings/refund-panel';
import { fetchAdminBookingByCode } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import {
  formatAmount,
  formatDateRange,
  formatDateTime,
  formatGuests,
  statusBadgeVariant,
  statusLabel,
} from '@/lib/bookings-view';
import { cancellationStatusBadgeVariant } from '@/lib/cancellations-view';
import { refundBookingAction } from './actions';

/**
 * `/bookings/[code]` — chi tiết theo `AdminBookingDetailSchema` (spec P4b
 * §3-F1): khách · đợt · tiền · lịch sử cancellation append-only, cộng ô
 * Refunds (F2) là hành vi GHI duy nhất của trang.
 *
 * Từ vòng vá review 31/08, `admin.bookings.byCode` trả sổ cái THẬT
 * (`refunds` + `refundedTotal` aggregate từ DB) — `RefundPanel` in ledger
 * ngay khi mở trang và dùng phần-còn-hoàn-được làm trần validate; sau mỗi
 * refund client `router.refresh()` kéo sự thật mới về.
 */
const t = messages.admin.bookings.detail;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `${code} — Bookings` };
}

export default async function BookingDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cookie = (await cookies()).toString();
  // Session (nav-user) và chi tiết booking độc lập nhau — song song cho khỏi
  // tốn 2 RTT nối tiếp (review 31/08, cùng nếp trang danh sách).
  const [session, booking] = await Promise.all([
    getServerSession(),
    fetchAdminBookingByCode(cookie, code),
  ]);
  if (!session) return null;
  if (!booking) notFound();

  return (
    <AdminShell user={session}>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Link
          href="/bookings"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ChevronLeftIcon className="size-4" />
          {t.back}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-2xl font-semibold tracking-tight">{booking.code}</h2>
          <Badge variant={statusBadgeVariant(booking.status)}>{statusLabel(booking.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {t.booked} {formatDateTime(booking.createdAt)}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t.customer.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Row label={t.customer.name} value={booking.contactName} />
                <Row label={t.customer.email} value={booking.contactEmail} />
                <Row label={t.customer.phone} value={booking.contactPhone} />
                <Row label={t.customer.requests} value={booking.specialRequests} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.departure.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Row label={t.departure.tour} value={booking.tourTitle} />
                <Row
                  label={t.departure.dates}
                  value={formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                />
                <Row label={t.departure.guests} value={formatGuests(booking)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.payment.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Row label={t.payment.provider} value={booking.paymentProvider} />
                <Row
                  label={t.payment.unitPrice}
                  value={formatAmount(booking.unitPrice, booking.currency)}
                />
                <Row
                  label={t.payment.total}
                  value={formatAmount(booking.totalAmount, booking.currency)}
                />
                <Row label={t.payment.paidAt} value={formatDateTime(booking.paidAt)} />
                <Row label={t.payment.cancelledAt} value={formatDateTime(booking.cancelledAt)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Ô refund đứng TRƯỚC lịch sử huỷ: nó là hành động, phần dưới là
            dấu vết. Server action truyền xuống như một prop — client
            component không tự import đường server nào (xem RefundPanel).
            Cắt ĐÚNG subset panel cần chứ không đưa cả detail qua ranh giới
            client: detail mang decisionNote nội bộ và mọi field mới sau này
            sẽ tự trôi xuống browser không qua cửa review (review 31/08). */}
        <RefundPanel
          booking={{
            code: booking.code,
            status: booking.status,
            totalAmount: booking.totalAmount,
            refundedTotal: booking.refundedTotal,
            currency: booking.currency,
            contactName: booking.contactName,
            refunds: booking.refunds,
          }}
          refund={refundBookingAction}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t.cancellations.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            {booking.cancellationRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.cancellations.empty}</p>
            ) : (
              // Lịch sử append-only (D1-B): cũ nhất trước, các dòng DENIED sống
              // sót qua mọi lần khách xin lại — đó là dấu vết, không phải rác.
              <ol className="grid gap-4">
                {booking.cancellationRequests.map((request) => (
                  <CancellationRow key={request.id} request={request} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

/** Một dòng `<dt>/<dd>`; giá trị trống hiện gạch ngang thay vì ô rỗng khó hiểu. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || t.empty}</dd>
    </div>
  );
}

function CancellationRow({ request }: { request: CancellationRequest }) {
  return (
    <li className="grid gap-1 border-l-2 border-border pl-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Cùng luật màu với hàng đợi /cancellations (review F3 31/08) — một
            trạng thái một màu ở mọi màn. */}
        <Badge variant={cancellationStatusBadgeVariant(request.status)}>
          {t.cancellations.status[request.status]}
        </Badge>
        <span className="text-muted-foreground">
          {t.cancellations.requested} {formatDateTime(request.createdAt)}
        </span>
        {request.decidedAt ? (
          <span className="text-muted-foreground">
            · {t.cancellations.decided} {formatDateTime(request.decidedAt)}
          </span>
        ) : null}
      </div>
      <p>
        <span className="text-muted-foreground">{t.cancellations.reason}: </span>
        {request.reason}
      </p>
      {request.decisionNote ? (
        <p>
          <span className="text-muted-foreground">{t.cancellations.note}: </span>
          {request.decisionNote}
        </p>
      ) : null}
    </li>
  );
}
