import type { AdminBookingDetail, Refund } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { Timeline, TimelineItem } from '@/components/kit/timeline';
import {
  formatAmount,
  formatDateRange,
  formatDateTime,
  formatGuests,
  statusBadgeVariant,
  statusLabel,
} from '@/lib/bookings-view';
import {
  type CancellationHistoryRowVM,
  toCancellationHistoryRow,
} from '@/lib/cancellation-history';

/**
 * Các khối trình bày của MỘT booking cho `/bookings/[code]` (tách khỏi trang ở
 * 04/09). Vùng Cancellations từng dùng chung các khối này; ADR-0041 gỡ vùng ấy,
 * nên trang chi tiết booking là nơi DUY NHẤT xem một lần huỷ.
 *
 * Vì sao ở `components/bookings/` chứ không phải `components/kit/`: kit là chỗ
 * của thứ KHÔNG biết miền nào (bảng, menu, dialog). Mấy khối này biết
 * `AdminBookingDetail` từ đầu tới cuối — chúng là trình bày của MIỀN booking.
 *
 * Toàn bộ file là server component thuần: không state, không handler. Phần
 * GHI (RefundPanel) do TRANG lắp vào.
 */
const t = messages.admin.bookings.detail;
const tRefunds = messages.admin.bookings.refund;

/** Link quay lại danh sách. `href` do trang dựng (mỗi vùng một hàng đợi). */
export function BookingDetailBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  );
}

/** Mã booking + huy hiệu trạng thái + mốc đặt. */
export function BookingDetailHeader({ booking }: { booking: AdminBookingDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-mono text-2xl font-semibold tracking-tight">{booking.code}</h2>
      <Badge variant={statusBadgeVariant(booking.status)}>{statusLabel(booking.status)}</Badge>
      <span className="text-sm text-muted-foreground">
        {t.booked} {formatDateTime(booking.createdAt)}
      </span>
    </div>
  );
}

/** Ba card ngữ cảnh: khách · đợt khởi hành · tiền. Thuần đọc. */
export function BookingSummaryCards({ booking }: { booking: AdminBookingDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{t.customer.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <DetailRow label={t.customer.name} value={booking.contactName} />
            <DetailRow label={t.customer.email} value={booking.contactEmail} />
            <DetailRow label={t.customer.phone} value={booking.contactPhone} />
            <DetailRow label={t.customer.requests} value={booking.specialRequests} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.departure.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <DetailRow label={t.departure.tour} value={booking.tourTitle} />
            <DetailRow
              label={t.departure.dates}
              value={formatDateRange(booking.departureStartDate, booking.departureEndDate)}
            />
            <DetailRow label={t.departure.guests} value={formatGuests(booking)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.payment.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <DetailRow label={t.payment.provider} value={booking.paymentProvider} />
            <DetailRow
              label={t.payment.unitPrice}
              value={formatAmount(booking.unitPrice, booking.currency)}
            />
            <DetailRow
              label={t.payment.total}
              value={formatAmount(booking.totalAmount, booking.currency)}
            />
            <DetailRow label={t.payment.paidAt} value={formatDateTime(booking.paidAt)} />
            <DetailRow label={t.payment.cancelledAt} value={formatDateTime(booking.cancelledAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Lịch sử huỷ append-only, cũ nhất trước: ai huỷ, lúc nào, trong hay quá hạn
 * chót, hoàn bao nhiêu, lý do (spec §6). Mọi câu dựng ở
 * `lib/cancellation-history.ts`; ở đây chỉ bày ra.
 */
export function CancellationHistoryCard({ booking }: { booking: AdminBookingDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.cancellations.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline empty={t.cancellations.empty}>
          {booking.cancellationRequests.map((request) => (
            <CancellationHistoryRow
              key={request.id}
              row={toCancellationHistoryRow(request, booking)}
            />
          ))}
        </Timeline>
      </CardContent>
    </Card>
  );
}

/** Một dòng `<dt>/<dd>`; giá trị trống hiện gạch ngang thay vì ô rỗng khó hiểu. */
export function DetailRow({ label, value }: { label: string; value: string | null }) {
  // Cột nhãn 9rem — nhãn của khối này dài hơn một nhịp so với mặc định kit.
  return <LabelValueRow label={label} width="md" value={value || t.empty} />;
}

function CancellationHistoryRow({ row }: { row: CancellationHistoryRowVM }) {
  return (
    <TimelineItem>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={row.badgeVariant}>{row.statusLabel}</Badge>
        {row.actor ? <span className="font-medium">{row.actor}</span> : null}
        <span className="text-muted-foreground">
          {t.cancellations.requested} {row.requested}
        </span>
        {row.decided ? (
          <span className="text-muted-foreground">
            · {t.cancellations.decided} {row.decided}
          </span>
        ) : null}
      </div>
      {row.deadline && row.refund ? (
        <p>
          {row.deadline} · {row.refund}
        </p>
      ) : null}
      <p>
        <span className="text-muted-foreground">{t.cancellations.reason}: </span>
        {row.reason}
      </p>
      {row.decisionNote ? (
        <p>
          <span className="text-muted-foreground">{t.cancellations.note}: </span>
          {row.decisionNote}
        </p>
      ) : null}
    </TimelineItem>
  );
}

/**
 * Sổ cái refund append-only — row và tổng đều là số THẬT server trả.
 *
 * Người dùng duy nhất là `RefundPanel`; bảng nằm ở file này vì là trình bày
 * của miền booking, cùng họ với các khối trên.
 */
export function RefundLedgerTable({
  refunds,
  refundedTotal,
  currency,
}: {
  refunds: Refund[];
  refundedTotal: string;
  currency: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label={tRefunds.ledger.heading}>
          <TableHeader>
            <TableRow>
              <TableHead>{tRefunds.ledger.amount}</TableHead>
              <TableHead>{tRefunds.ledger.issued}</TableHead>
              <TableHead>{tRefunds.ledger.reference}</TableHead>
              <TableHead>{tRefunds.ledger.reason}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((refund) => (
              <TableRow key={refund.id}>
                <TableCell className="tabular-nums">
                  {formatAmount(refund.amount, refund.currency)}
                </TableCell>
                <TableCell>{formatDateTime(refund.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {refund.providerRefundId ?? t.empty}
                </TableCell>
                {/* Lý do NỘI BỘ của refund thiện chí (ADR-0030 AMEND 2) — trống
                    với auto-refund và approve theo chính sách. */}
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {refund.reason ?? t.empty}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Tổng là `refundedTotal` server aggregate — không cộng lại phía client
          (hai công thức tiền là hai công thức sẽ lệch, review 31/08). */}
      <p className="font-medium tabular-nums">
        {tRefunds.ledger.total(formatAmount(refundedTotal, currency))}
      </p>
    </div>
  );
}
