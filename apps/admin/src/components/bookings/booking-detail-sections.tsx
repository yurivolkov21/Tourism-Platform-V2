import type { AdminBookingDetail, CancellationRequest, Refund } from '@tourism/contract';
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
import { cancellationStatusBadgeVariant } from '@/lib/cancellations-view';

/**
 * Các khối trình bày của MỘT booking, tách khỏi `/bookings/[code]` ở 04/09 khi
 * `/cancellations/[code]` ra đời (user chốt: hai vùng có trang chi tiết RIÊNG,
 * dùng chung kiểu thiết kế chứ không chung route).
 *
 * Vì sao ở `components/bookings/` chứ không phải `components/kit/`: kit là chỗ
 * của thứ KHÔNG biết miền nào (bảng, menu, dialog). Mấy khối này biết
 * `AdminBookingDetail` từ đầu tới cuối — chúng là trình bày của MIỀN booking,
 * và vùng bookings là chủ. `/cancellations` import sang, đúng như nó đã import
 * `formatCalendarDate` của `bookings-view`.
 *
 * Cắt theo KHỐI MÀN HÌNH chứ không theo từng thẻ nhỏ: hai trang phải nhìn ra
 * là một hệ, nên thứ dùng chung phải là cả cụm ba card, cả khung lịch sử —
 * chia nhỏ hơn thì mỗi trang tự ghép một kiểu và chúng lại trôi lệch.
 *
 * Toàn bộ file là server component thuần: không state, không handler. Phần
 * GHI (RefundPanel, DecideActions) do TRANG lắp vào, nên mỗi vùng tự quyết
 * mình cho phép làm gì — đó chính là ranh giới user muốn có.
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
 * Lịch sử huỷ append-only (D1-B): cũ nhất trước, các dòng DENIED sống sót qua
 * mọi lần khách xin lại — đó là dấu vết, không phải rác.
 */
export function CancellationHistoryCard({
  requests,
}: {
  requests: readonly CancellationRequest[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.cancellations.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline empty={t.cancellations.empty}>
          {requests.map((request) => (
            <CancellationHistoryRow key={request.id} request={request} />
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

function CancellationHistoryRow({ request }: { request: CancellationRequest }) {
  return (
    <TimelineItem>
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
    </TimelineItem>
  );
}

/**
 * Sổ cái refund dạng CARD, thuần đọc — dùng ở `/cancellations/[code]`, nơi
 * sổ là BẰNG CHỨNG để quyết chứ không phải chỗ phát lệnh tiền. Đường hoàn
 * tiền của màn ấy là Approve, vì chỉ nó mới đóng request và nhả ghế.
 */
export function RefundLedger({
  refunds,
  refundedTotal,
  currency,
}: {
  refunds: Refund[];
  refundedTotal: string;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tRefunds.heading}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {refunds.length > 0 ? (
          <RefundLedgerTable refunds={refunds} refundedTotal={refundedTotal} currency={currency} />
        ) : (
          <p className="text-muted-foreground">{tRefunds.ledger.none}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sổ cái refund append-only — row và tổng đều là số THẬT server trả.
 *
 * Ở đây (server component) chứ không ở `refund-panel.tsx` ('use client') vì
 * từ 04/09 nó có HAI người dùng: panel phát refund của `/bookings/[code]`, và
 * khối thuần-đọc của `/cancellations/[code]`. Người thứ hai không cần một byte
 * JavaScript nào để in một cái bảng.
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
