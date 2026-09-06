import { messages } from '@tourism/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import {
  BookingDetailBackLink,
  BookingDetailHeader,
  BookingSummaryCards,
  CancellationHistoryCard,
  RefundLedger,
} from '@/components/bookings/booking-detail-sections';
import { DecideActions } from '@/components/cancellations/decide-actions';
import { fetchAdminBookingByCode } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { cancellationsBackHref } from '@/lib/cancellations-query';
import type { RawSearchParams } from '@/lib/table-query';
import { decideCancellationAction } from '../actions';

/**
 * `/cancellations/[code]` — trang chi tiết RIÊNG của vùng huỷ (user chốt
 * 04/09). Trước đó cả hai vùng chung một route `/bookings/[code]`, nên nút
 * quyết định phải nằm trong bảng và lệnh tiền được bấm từ một hàng.
 *
 * Ba khác biệt so với `/bookings/[code]`, và cả ba đều là chủ đích:
 *
 * 1. **Đây là màn QUYẾT ĐỊNH.** Approve/Deny rời cột Decision của hàng đợi về
 *    đây, nơi nhìn đủ ngữ cảnh trước khi bấm: tiền đã hoàn, ngày khởi hành,
 *    số khách, lịch sử xin huỷ. Quyết một lệnh tiền từ một hàng bảng là quá
 *    mỏng cho thứ vừa hoàn tiền vừa nhả ghế.
 * 2. **Sổ hoàn tiền hiện READ-ONLY.** Cùng khối ledger với `/bookings/[code]`
 *    nhưng KHÔNG kèm form phát refund — ở màn này đường đúng để hoàn tiền là
 *    Approve, vì chỉ nó mới đóng request, huỷ booking và nhả ghế.
 * 3. **Định danh bằng MÃ BOOKING**, không phải id request — xem
 *    `cancellationDetailHref`.
 *
 * Dùng lại `admin.bookings.byCode`: nó đã trả `cancellationRequests` +
 * `refunds` + `refundedTotal` thật (review F2 31/08), tức đủ mọi thứ màn này
 * cần. Không thêm endpoint nào.
 */
const t = messages.admin.cancellations.detail;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `${code} — Cancellations` };
}

export default async function CancellationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { code } = await params;
  // Bộ lọc hàng đợi đi kèm trên URL (do `cancellationDetailHref` gắn) — nút
  // quay về dựng lại đúng danh sách vừa rời, cùng luật với `/bookings`.
  const backHref = cancellationsBackHref(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, booking] = await Promise.all([
    getServerSession(),
    fetchAdminBookingByCode(cookie, code),
  ]);
  if (!session) return null;
  if (!booking) notFound();

  // Nhiều nhất MỘT request đang mở cho mỗi booking (partial unique index phía
  // DB) — nên "cái đang chờ quyết" là xác định, không cần chọn.
  const open = booking.cancellationRequests.find((request) => request.status === 'REQUESTED');

  return (
    <AdminShell user={session}>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <BookingDetailBackLink href={backHref} label={t.back} />
        <BookingDetailHeader booking={booking} />
        <BookingSummaryCards booking={booking} />

        {/* Hai cột (user chốt 04/09): BẰNG CHỨNG bên trái, VIỆC PHẢI LÀM bên
            phải. Sổ hoàn tiền và lịch sử huỷ là hai bảng nên chúng cần bề
            ngang — 2/3; khối quyết định là một cụm nút nên 1/3 là đủ, và đứng
            riêng một cột thì nó không bị hai bảng dài đẩy xuống dưới màn hình.
            Hai bảng KHÔNG gộp: một cái là sổ tiền, một cái là dấu vết quyết
            định — gộp lại là trộn hai loại bản ghi. */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Sổ hoàn tiền THUẦN ĐỌC — bằng chứng để quyết, không phải chỗ
                phát lệnh tiền. Đường hoàn tiền của màn này là Approve. */}
            <RefundLedger
              refunds={booking.refunds}
              refundedTotal={booking.refundedTotal}
              currency={booking.currency}
            />
            <CancellationHistoryCard requests={booking.cancellationRequests} />
          </div>

          {/* `lg:sticky` để cụm quyết định còn trong tầm mắt khi cột trái dài
              ra — một booking xin huỷ nhiều lần thì lịch sử cuộn khá xa. */}
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>{t.heading}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {open ? t.open : booking.cancellationRequests.length > 0 ? t.closed : t.none}
              </p>
              {open ? (
                // Cắt ĐÚNG subset cụm nút cần chứ không đưa cả detail qua ranh
                // giới client (review 31/08) — cùng luật với `RefundPanel`.
                <DecideActions
                  request={{
                    id: open.id,
                    bookingCode: booking.code,
                    tourTitle: booking.tourTitle,
                    customerName: booking.contactName,
                    reason: open.reason,
                    totalAmount: booking.totalAmount,
                    refundedTotal: booking.refundedTotal,
                    currency: booking.currency,
                    // Dữ kiện để TÍNH mức hoàn theo chính sách (ADR-0030):
                    // mốc đếm là lúc KHÁCH gửi, không phải lúc admin mở dialog.
                    requestedAt: open.createdAt,
                    paidAt: booking.paidAt,
                    departureStartDate: booking.departureStartDate,
                    // SNAPSHOT lúc khách gửi (ADR-0029 AMEND 6), không phải badge
                    // hiện tại của tour — server duyệt theo đúng con số này.
                    freeCancellationDays: open.freeCancellationDays,
                  }}
                  decide={decideCancellationAction}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
