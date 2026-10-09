import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
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
import { formatBookingMoney } from '@/lib/checkout';
import type { VoucherView } from '@/lib/voucher';

/**
 * Cột trái của voucher (spec P7 §6.2, cách "A" của bản vẽ `booking-voucher.src.html`): mộc
 * trạng thái, tiêu đề và dòng phụ theo `voucherView`, thẻ ảnh bìa lớn, lưới bốn ô có icon (ba ô
 * khi voucher đã đi hay đã huỷ: không còn ô Meeting point).
 *
 * Tiêu đề là `h2` — `h1` duy nhất của trang là tên tour ở hero (cùng lý do `BookingReceipt`).
 *
 * Khi thẻ một cột (dưới `xl` — điện thoại, máy tính bảng) ô mã bản gọn đứng ngay dưới tiêu đề:
 * khách mở voucher ở điểm đón cần thấy mã trước tiên, còn mảng teal (mang ô mã của thẻ hai cột)
 * nằm cuối trang (spec §6.4). Thẻ chia đôi — từ `xl`, và khi in — thì ô gọn giấu: biến thể
 * `voucher-split:` của `globals.css`, cùng ngưỡng chia cột của `VoucherCard`.
 */
export function VoucherOverview({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  /**
   * Điểm hẹn của tour (`voucherMeetingPoint`); `null` khi tour đã gỡ, API catalog lỗi, tour chưa ghi
   * điểm hẹn — hay voucher không có ô Meeting point (`view.showMeetingPoint` sai, trang không đọc
   * tour).
   */
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
          {/* Email của khách nằm trong dòng phụ: chuỗi liền dài phải bẻ được ở bất kỳ đâu. */}
          <p className="mt-2 text-sm text-muted-foreground wrap-anywhere">{view.subtitle}</p>
        </div>
        <div className="shrink-0 self-start sm:pt-1">
          {/* Mộc theo giai đoạn (`bookingPass(…).stamp`), cùng luật với vé của trang chi tiết đơn. */}
          <VisaStamp {...view.stamp} />
        </div>
      </div>

      {view.cancelledNotice === null ? (
        <VoucherCode code={booking.code} className="mt-5 voucher-split:hidden" />
      ) : (
        <VoucherCancelledNotice text={view.cancelledNotice} className="mt-5 voucher-split:hidden" />
      )}

      {/* Chiều cao TỐI THIỂU, không cố định: khối chữ nằm trong luồng và xếp ở đáy (flex
          `justify-end`), nên chữ nhiều thì đẩy ảnh cao lên. Bản cũ cao cố định 224px còn khối
          chữ neo đáy, nên ở 375px tên tour thật dài nhất của seed ("Northern Highlights: Hanoi–
          Hạ Long–Ninh Bình 5D4N") tràn qua mép trên và bị `overflow-hidden` cắt mất dòng đầu. */}
      <div
        data-slot="voucher-photo"
        className="relative mt-6 flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl bg-muted md:min-h-72 print:min-h-44"
      >
        {/* `sizes` theo đúng bề rộng ô ảnh (review P7C#12) = màn − lề ngang của trang
            `/checkout/success` (2×16 · 2×64 từ md · 2×96 từ lg · 2×128 từ xl) − viền thẻ (2) − đệm
            ngang cột này (2×24 · 2×40 từ md); từ `xl` trừ thêm mảng teal 440px, thẻ chặn ở
            `max-w-7xl` nên từ 1536px ô ảnh đứng yên 758px. Mốc 1280px là `xl` — mốc chia đôi của
            thẻ (`sizes` không đọc được biến thể CSS). Không `priority`: ở điện thoại ảnh nằm dưới
            mép gập (dưới hero, tiêu đề, ô mã), nạp sớm chỉ giành băng thông của thứ khách thấy
            trước. */}
        <SlotImage
          image={booking.tourImage}
          className="absolute inset-0"
          sizes="(min-width: 1536px) 758px, (min-width: 1280px) calc(100vw - 778px), (min-width: 1024px) calc(100vw - 274px), (min-width: 768px) calc(100vw - 210px), calc(100vw - 82px)"
        />
        {/* Lớp tối GẮN VÀO khối chữ (khuôn caption của `journey-moments.tsx`, `home/gallery.tsx`)
            thay vì phủ cố định theo chiều cao ảnh: tiêu đề xuống dòng hay chip rớt hàng thì lớp
            tối cao theo. Lớp cũ (trong suốt tới 30% chiều cao ảnh) để ở 375px dòng nhỏ đầu khối
            và dòng tên tour nằm trên ảnh trần — 1,0–1,3:1 trên ảnh sáng.

            MỘT gradient: 90% ở đáy, 70% đúng mép trên chữ (`via` đặt cách đỉnh 4rem = `pt-16`),
            trong suốt ở đỉnh phần đệm — dải mờ dần nằm trong phần đệm nên không có đường nối
            giữa hai lớp. Đo trên CSS build thật: mọi dòng chữ ≥ 5,4:1 kể cả trên ảnh trắng tinh.
            Dòng nhỏ đầu khối thôi `opacity-80`: chữ 10.5px không chịu thêm một lớp làm mờ.
            `relative` để khối (trong luồng) vẽ đè lên ảnh `absolute` đứng trước nó. */}
        <div
          data-slot="voucher-photo-caption"
          className="relative bg-linear-to-t from-hero/90 via-hero/70 via-[calc(100%-4rem)] to-transparent px-6 pt-16 pb-5 text-on-media"
        >
          <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase">
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
        {/* Ô Meeting point chỉ khi điểm hẹn còn việc — sắp đi, đang đi (`showMeetingPoint`, review
            P7C#6): voucher đã đi hay đã huỷ không mời ai hỏi điểm hẹn của một chuyến đã xong. */}
        {view.showMeetingPoint ? (
          <InfoCell icon={<MapPinIcon aria-hidden="true" />} title={t.meetingPoint}>
            {/* Không có điểm hẹn để in thì mời liên hệ — email xác nhận không mang điểm hẹn, nên
                không được hứa "Details are in your confirmation email." (review P7C#4, D4). */}
            {meetingPoint ?? (
              <>
                <ContactLink>{t.meetingPointContact}</ContactLink> {t.meetingPointFallback}
              </>
            )}
          </InfoCell>
        ) : null}
        <InfoCell icon={<CreditCardIcon aria-hidden="true" />} title={t.paidWith(view.provider)}>
          {`${view.paidOn} · ${messages.tourDetail.booking.testMode}`}
        </InfoCell>
        <InfoCell icon={<UserIcon aria-hidden="true" />} title={t.leadTraveller}>
          {`${booking.contactName} · ${booking.contactEmail}`}
        </InfoCell>
        <InfoCell
          icon={<MessageSquareIcon aria-hidden="true" />}
          title={t.needHelp}
          // Thiếu ô Meeting point thì còn ba ô: ô cuối trải trọn hàng thay vì để lưới 2×2 hở một góc.
          className={view.showMeetingPoint ? undefined : 'sm:col-span-2'}
        >
          {t.needHelpBody} <ContactLink>{t.contactUs}</ContactLink>.
        </InfoCell>
      </div>
    </div>
  );
}

/** Link `/contact` nằm giữa dòng chữ phụ của một ô (Meeting point dự phòng, Need help?). */
function ContactLink({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/contact"
      className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
    >
      {children}
    </Link>
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
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Lớp thêm cho ô — chỉ để đổi chỗ đứng trong lưới (vd trải trọn hàng). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[2.375rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border px-4 py-3.5',
        className,
      )}
    >
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
