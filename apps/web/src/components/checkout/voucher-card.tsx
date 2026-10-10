import type { BookingDetail } from '@tourism/contract';
import { SuccessCelebration } from '@/components/checkout/success-celebration';
import { VoucherOverview } from '@/components/checkout/voucher-overview';
import { VoucherPass } from '@/components/checkout/voucher-pass';
import type { VoucherView } from '@/lib/voucher';

/**
 * Voucher của đơn đã trả ở `/checkout/success` (spec P7 §6, bản vẽ `booking-voucher.src.html`):
 * MỘT thẻ bo góc `max-w-7xl` chia đôi — cột trái co giãn (`VoucherOverview`), cột phải 440px
 * mảng teal (`VoucherPass`).
 *
 * Hai cột chỉ khi thẻ chia đôi — biến thể `voucher-split:` của `globals.css`: từ `xl`; dưới đó
 * một cột, mảng teal xuống cuối theo thứ tự DOM. Cột phải cố định
 * 440px còn lề trang khớp hero, nên với mốc `md` của plan cột trái ở 768px chỉ còn 194px và cột
 * chữ của bốn ô thông tin còn 0px, ở 1024px còn 63px (đo trên CSS build thật, đợt vá sau C5).
 * Từ 1280px cột trái được ~580px — đúng khổ bản vẽ đã duyệt. Cùng mốc với vé của trang chi
 * tiết đơn (plan P7, quyết định 13).
 *
 * Thẻ một cột cũng khai cột tường minh (`grid-cols-1` = `minmax(0, 1fr)`): cột ngầm `auto` nở
 * theo chuỗi dài nhất không ngắt được — email 44 ký tự của dòng phụ đẩy cột lên 350px ở màn
 * 320px, rồi `overflow-hidden` của thẻ cắt mất mép phải cả hai cột (nút "Copy code", tổng tiền).
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
        className="mx-auto grid w-full max-w-7xl grid-cols-1 overflow-hidden rounded-4xl border bg-card text-card-foreground voucher-split:grid-cols-[minmax(0,1fr)_440px]"
      >
        <VoucherOverview booking={booking} view={view} meetingPoint={meetingPoint} />
        <VoucherPass booking={booking} view={view} />
      </article>
    </>
  );
}
