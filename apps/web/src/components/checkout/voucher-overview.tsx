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
import { formatBookingMoney } from '@/lib/checkout';
import type { VoucherView } from '@/lib/voucher';

/**
 * Cột trái của voucher (spec P7 §6.2, cách "A" của bản vẽ `booking-voucher.src.html`): mộc
 * trạng thái, tiêu đề và dòng phụ theo `voucherView`, thẻ ảnh bìa lớn, lưới bốn ô có icon.
 *
 * Tiêu đề là `h2` — `h1` duy nhất của trang là tên tour ở hero (cùng lý do `BookingReceipt`).
 *
 * Khi thẻ một cột (dưới `xl` — điện thoại, máy tính bảng) ô mã bản gọn đứng ngay dưới tiêu đề:
 * khách mở voucher ở điểm đón cần thấy mã trước tiên, còn mảng teal (mang ô mã của thẻ hai cột)
 * nằm cuối trang (spec §6.4). Mốc `xl` cùng mốc chia cột của `VoucherCard`.
 */
export function VoucherOverview({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  /**
   * Điểm hẹn của tour (`fetchTourDetailOrNull`); `null` khi tour đã gỡ, API catalog lỗi hoặc tour
   * chưa ghi điểm hẹn.
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
          <p className="mt-2 text-sm text-muted-foreground">{view.subtitle}</p>
        </div>
        <div className="shrink-0 self-start sm:pt-1">
          {/* Mộc theo giai đoạn (`bookingPass(…).stamp`), cùng luật với vé của trang chi tiết đơn. */}
          <VisaStamp {...view.stamp} />
        </div>
      </div>

      {view.cancelledNotice === null ? (
        <VoucherCode code={booking.code} className="mt-5 xl:hidden print:hidden" />
      ) : (
        <VoucherCancelledNotice
          text={view.cancelledNotice}
          className="mt-5 xl:hidden print:hidden"
        />
      )}

      {/* Chiều cao TỐI THIỂU, không cố định: khối chữ nằm trong luồng và xếp ở đáy (flex
          `justify-end`), nên chữ nhiều thì đẩy ảnh cao lên. Bản cũ cao cố định 224px còn khối
          chữ neo đáy, nên ở 375px tên tour thật dài nhất của seed ("Northern Highlights: Hanoi–
          Hạ Long–Ninh Bình 5D4N") tràn qua mép trên và bị `overflow-hidden` cắt mất dòng đầu. */}
      <div
        data-slot="voucher-photo"
        className="relative mt-6 flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl bg-muted md:min-h-72 print:min-h-44"
      >
        {/* Ảnh rộng gần hết thẻ khi thẻ một cột; từ `xl` cột trái còn ~45% màn. */}
        <SlotImage
          image={booking.tourImage}
          className="absolute inset-0"
          sizes="(min-width: 1280px) 45vw, 100vw"
          priority
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
