import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CalendarIcon,
  CreditCardIcon,
  MapPinIcon,
  MessageSquareIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { VoucherCancelledNotice, VoucherCode } from '@/components/checkout/voucher-code';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { SlotImage } from '@/components/slot-image';
import { bookingView } from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import type { VoucherView } from '@/lib/voucher';

/**
 * Cột trái của voucher (spec P7 §6.2, cách "A" của bản vẽ `booking-voucher.src.html`): mộc
 * trạng thái, tiêu đề và dòng phụ theo `voucherView`, thẻ ảnh bìa lớn, lưới bốn ô có icon.
 *
 * Tiêu đề là `h2` — `h1` duy nhất của trang là tên tour ở hero (cùng lý do `BookingReceipt`).
 *
 * Trên điện thoại ô mã bản gọn đứng ngay dưới tiêu đề: khách mở voucher ở điểm đón cần thấy mã
 * trước tiên, còn mảng teal (mang ô mã của màn rộng) nằm cuối trang (spec §6.4).
 */
export function VoucherOverview({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  /** Điểm hẹn của tour (`fetchTourDetail`); `null` khi tour đã gỡ hoặc chưa ghi điểm hẹn. */
  meetingPoint: string | null;
}) {
  const t = messages.voucher;
  return (
    <div data-slot="voucher-overview" className="p-6 md:px-10 md:pt-8 md:pb-9">
      {/* Điện thoại: mộc đứng trên tiêu đề (cột đảo chiều). Từ `sm` mộc sang phải, CÙNG HÀNG
          tiêu đề — không đặt tuyệt đối như bản vẽ: cột trái ở 1280px chỉ còn ~500px chữ (lề
          ngang khớp hero), mộc tuyệt đối sẽ đè lên tiêu đề hai dòng. */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-lg">
          <h2 className="font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl">
            {view.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{view.subtitle}</p>
        </div>
        <div className="shrink-0 self-start sm:pt-1">
          <VisaStamp status={booking.status} tone={bookingView(booking).tone} />
        </div>
      </div>

      {view.showCode ? (
        <VoucherCode code={booking.code} className="mt-5 md:hidden print:hidden" />
      ) : view.cancelledNotice ? (
        <VoucherCancelledNotice
          text={view.cancelledNotice}
          className="mt-5 md:hidden print:hidden"
        />
      ) : null}

      <div
        data-slot="voucher-photo"
        className="relative mt-6 h-56 overflow-hidden rounded-3xl bg-muted md:h-72 print:h-44"
      >
        <SlotImage
          image={booking.tourImage}
          className="absolute inset-0"
          sizes="(min-width: 768px) 60vw, 100vw"
          priority
        />
        {/* Lớp tối mờ dần ở đáy để chữ sáng đọc được trên mọi ảnh. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-transparent from-30% to-hero/90"
        />
        <div className="absolute inset-x-6 bottom-5 text-on-media">
          <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase opacity-80">
            {t.photoKicker(view.place, view.tripDays)}
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="font-heading text-2xl leading-tight font-semibold">{booking.tourTitle}</p>
            <p className="shrink-0 font-mono text-xl font-semibold tabular-nums">
              {formatBookingMoney(booking, booking.totalAmount)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassChip icon={<CalendarIcon aria-hidden="true" />}>{view.departure}</GlassChip>
            <GlassChip icon={<UsersIcon aria-hidden="true" />}>
              {t.partyPrice(
                messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
                formatBookingMoney(booking, booking.unitPrice),
              )}
            </GlassChip>
          </div>
        </div>
      </div>

      <div className="mt-4.5 grid gap-3 sm:grid-cols-2">
        <InfoCell icon={<MapPinIcon aria-hidden="true" />} title={t.meetingPoint}>
          {meetingPoint ?? t.meetingPointFallback}
        </InfoCell>
        <InfoCell icon={<CreditCardIcon aria-hidden="true" />} title={t.paidWith(view.provider)}>
          {`${view.paidOn} · ${messages.tourDetail.booking.testMode}`}
        </InfoCell>
        <InfoCell icon={<UserIcon aria-hidden="true" />} title={t.leadTraveller}>
          {`${booking.contactName} · ${booking.contactEmail}`}
        </InfoCell>
        <InfoCell icon={<MessageSquareIcon aria-hidden="true" />} title={t.needHelp}>
          {t.needHelpBody}{' '}
          <Link
            href="/contact"
            className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
          >
            {t.contactUs}
          </Link>
          .
        </InfoCell>
      </div>
    </div>
  );
}

/** Chip kính mờ trên ảnh — chữ `on-media` không lật theo theme vì nền luôn là ảnh tối. */
function GlassChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-on-media/30 bg-on-media/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

/** Một ô của lưới 2×2: icon trong ô vuông nhạt, tiêu đề đậm, một dòng chữ phụ. */
function InfoCell({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.375rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border px-4 py-3.5">
      <span className="grid size-9.5 place-items-center rounded-xl bg-primary/10 text-primary-emphasis [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground wrap-anywhere">{children}</p>
      </div>
    </div>
  );
}
