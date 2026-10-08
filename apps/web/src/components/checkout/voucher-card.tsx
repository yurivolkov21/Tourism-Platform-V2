import type { BookingDetail } from '@tourism/contract';
import { SuccessCelebration } from '@/components/checkout/success-celebration';
import { VoucherOverview } from '@/components/checkout/voucher-overview';
import { VoucherPass } from '@/components/checkout/voucher-pass';
import type { VoucherView } from '@/lib/voucher';

/**
 * Voucher của đơn đã trả ở `/checkout/success` (spec P7 §6, bản vẽ `booking-voucher.src.html`):
 * MỘT thẻ bo góc `max-w-7xl` chia đôi — cột trái co giãn (`VoucherOverview`), cột phải 440px
 * mảng teal (`VoucherPass`). Điện thoại một cột, mảng teal xuống cuối theo thứ tự DOM. Khi in,
 * cột phải hẹp còn 17rem để cả thẻ nằm gọn một trang A4 (số đo ở plan P7, Task C5).
 *
 * Pháo giấy gắn Ở ĐÂY chứ không ở trang: luật "chỉ khi vừa trả" nhờ vậy có test (Vitest không
 * quét `app/**`). `SuccessCelebration` vẫn tự giữ "một lần mỗi tab".
 */
export function VoucherCard({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  meetingPoint: string | null;
}) {
  return (
    <>
      {view.justPaid ? <SuccessCelebration bookingCode={booking.code} /> : null}
      <article
        data-slot="voucher"
        className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-4xl border bg-card text-card-foreground md:grid-cols-[minmax(0,1fr)_440px] print:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <VoucherOverview booking={booking} view={view} meetingPoint={meetingPoint} />
        <VoucherPass booking={booking} view={view} />
      </article>
    </>
  );
}
