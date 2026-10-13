import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ClockIcon, CreditCardIcon, MessageSquareIcon, UserIcon } from 'lucide-react';
import { PendingAction, PendingCode } from '@/components/checkout/pending-action';
import { PendingPass } from '@/components/checkout/pending-pass';
import { ContactLink, InfoCell } from '@/components/checkout/voucher-overview';
import { VoucherPhoto } from '@/components/checkout/voucher-photo';
import { VisaStamp } from '@/components/passport/visa-stamp';
import type { PendingView } from '@/lib/pending-receipt';

/**
 * Thẻ chờ của đơn CHƯA TRẢ ở `/checkout/cancel` và `/checkout/success` (G42, spec 2026-10-13,
 * phương án A của bản vẽ `pending-receipt.src.html`) — thay hoá đơn `BookingReceipt` từ 19/08.
 *
 * CÙNG KHUNG với voucher (`VoucherCard`): thẻ bo góc `max-w-7xl`, chia đôi từ `voucher-split:`
 * (`xl`), cột trái co giãn, cột phải 440px — nhưng cột phải là mảng `muted` thay mảng teal. Khi tiền
 * về, chính trang success đổi sang voucher: chỉ cột phải đổi màu và mộc đổi chữ, khách thấy một tài
 * liệu liền mạch (lý do user chọn A). Lý do cột một cột khai `grid-cols-1` tường minh: xem
 * `VoucherCard`.
 *
 * Mọi chữ, mộc, tiền và nhật ký tính sẵn ở `pendingView` — thẻ không đọc `status` hay giai đoạn.
 */
export function PendingCard({ booking, view }: { booking: BookingDetail; view: PendingView }) {
  return (
    <article
      data-slot="pending-card"
      className="mx-auto grid w-full max-w-7xl grid-cols-1 overflow-hidden rounded-4xl border bg-card text-card-foreground voucher-split:grid-cols-[minmax(0,1fr)_440px]"
    >
      <PendingOverview booking={booking} view={view} />
      <PendingPass booking={booking} view={view} />
    </article>
  );
}

/**
 * Cột trái: mộc, tiêu đề và câu phụ, ô mã gọn kèm hành động chính (chỉ dưới `xl`), ảnh bìa, lưới
 * bốn ô. Cùng đệm với `VoucherOverview` — `VOUCHER_PHOTO_SIZES` của ảnh bìa trừ đúng đệm này.
 *
 * Dưới `xl` hành động đứng ngay dưới câu phụ, TRƯỚC ảnh: trên điện thoại khách vừa bấm huỷ ở cổng
 * thấy Pay now mà không phải cuộn qua ảnh và bốn ô; khách về trước webhook thấy ngay dòng
 * "Checking…" (spec §8).
 */
function PendingOverview({ booking, view }: { booking: BookingDetail; view: PendingView }) {
  const v = messages.voucher;
  return (
    <div data-slot="pending-overview" className="p-6 md:px-10 md:pt-8 md:pb-9">
      {/* Mộc đứng trên tiêu đề ở điện thoại, cùng hàng từ `sm` — lý do ở `VoucherOverview`. */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-lg">
          <h2 className="font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl">
            {view.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{view.subtitle}</p>
        </div>
        <div className="shrink-0 self-start sm:pt-1">
          <VisaStamp {...view.stamp} />
        </div>
      </div>

      <div data-slot="pending-compact" className="mt-5 grid gap-3 voucher-split:hidden">
        <PendingCode code={booking.code} label={view.codeLabel} />
        {/* Bản này mang bộ hẹn giờ tự làm tươi: CSS chỉ giấu nó từ `xl`, không gỡ, nên nó chạy ở
            mọi bề rộng; bản ở cột phải chỉ có nút. */}
        <PendingAction booking={booking} action={view.action} autoRefresh compact />
      </div>

      <VoucherPhoto
        booking={booking}
        place={view.place}
        tripDays={view.tripDays}
        departure={view.departure}
        dimmed={view.dimmed}
        className="mt-6"
      />

      <div className="mt-4.5 grid gap-3 sm:grid-cols-2">
        <InfoCell
          icon={<ClockIcon aria-hidden="true" />}
          title={view.timeCell.title}
          warn={view.timeCell.warn}
        >
          {view.timeCell.body}
        </InfoCell>
        <InfoCell icon={<CreditCardIcon aria-hidden="true" />} title={view.provider}>
          {messages.tourDetail.booking.testMode}
        </InfoCell>
        <InfoCell icon={<UserIcon aria-hidden="true" />} title={v.leadTraveller}>
          {`${booking.contactName} · ${booking.contactEmail}`}
        </InfoCell>
        {/* Không "Reply to the confirmation email" như voucher: đơn chưa trả chưa có email xác nhận. */}
        <InfoCell icon={<MessageSquareIcon aria-hidden="true" />} title={v.needHelp}>
          <ContactLink>{messages.passportVisa.contactUs}</ContactLink>{' '}
          {messages.pendingReceipt.helpBody}
        </InfoCell>
      </div>
    </div>
  );
}
