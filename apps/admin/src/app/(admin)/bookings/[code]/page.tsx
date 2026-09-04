import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import {
  BookingDetailBackLink,
  BookingDetailHeader,
  BookingSummaryCards,
  CancellationHistoryCard,
} from '@/components/bookings/booking-detail-sections';
import { RefundPanel } from '@/components/bookings/refund-panel';
import { fetchAdminBookingByCode } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { bookingsBackHref } from '@/lib/bookings-query';
import type { RawSearchParams } from '@/lib/table-query';
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
 *
 * Từ 04/09 các khối trình bày nằm ở `booking-detail-sections.tsx` — dùng
 * chung với `/cancellations/[code]`, trang chi tiết RIÊNG của vùng huỷ (user
 * chốt: hai vùng hai route, chung kiểu thiết kế). Thứ KHÁC nhau giữa hai
 * trang là phần GHI: ở đây là `RefundPanel`, bên kia là cụm quyết định.
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { code } = await params;
  // Bộ lọc của bảng đi kèm trên URL (do `bookingDetailHref` gắn), nên nút quay
  // về dựng lại đúng danh sách vừa rời. `now` truyền vào chứ không đọc trong
  // hàm — cùng lý do với trang danh sách.
  const backHref = bookingsBackHref(await searchParams, new Date());
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
        <BookingDetailBackLink href={backHref} label={t.back} />
        <BookingDetailHeader booking={booking} />
        <BookingSummaryCards booking={booking} />

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

        <CancellationHistoryCard requests={booking.cancellationRequests} />
      </div>
    </AdminShell>
  );
}
