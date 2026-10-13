import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CreditCardIcon, MapPinIcon, MessageSquareIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { VoucherCancelledNotice, VoucherCode } from '@/components/checkout/voucher-code';
import { VoucherPhoto } from '@/components/checkout/voucher-photo';
import { VisaStamp } from '@/components/passport/visa-stamp';
import type { VoucherView } from '@/lib/voucher';

/**
 * Cột trái của voucher (spec P7 §6.2, cách "A" của bản vẽ `booking-voucher.src.html`): mộc
 * trạng thái, tiêu đề và dòng phụ theo `voucherView`, thẻ ảnh bìa lớn (`VoucherPhoto`), lưới bốn ô
 * có icon (ba ô khi voucher đã đi hay đã huỷ: không còn ô Meeting point).
 *
 * Tiêu đề là `h2` — `h1` duy nhất của trang là tên tour ở hero.
 *
 * Khi thẻ một cột (dưới `xl` — điện thoại, máy tính bảng) ô mã bản gọn đứng ngay dưới tiêu đề:
 * khách mở voucher ở điểm đón cần thấy mã trước tiên, còn mảng teal (mang ô mã của thẻ hai cột)
 * nằm cuối trang (spec §6.4). Thẻ chia đôi (từ `xl`) thì ô gọn giấu: biến thể
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
   * Điểm hẹn của tour (`tourMeetingPoint` của dữ liệu `voucherTourData`); `null` khi tour đã gỡ,
   * API catalog lỗi, tour chưa ghi điểm hẹn — hay voucher không có ô Meeting point
   * (`view.showMeetingPoint` sai, trang không đọc tour).
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

      <VoucherPhoto
        booking={booking}
        place={view.place}
        tripDays={view.tripDays}
        departure={view.departure}
        className="mt-6"
      />

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

/**
 * Link `/contact` nằm giữa dòng chữ phụ của một ô (Meeting point dự phòng, Need help?) — thẻ chờ
 * của đơn chưa trả (G42) dùng lại.
 */
export function ContactLink({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/contact"
      className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

/**
 * Một ô của lưới 2×2: icon trong ô vuông nhạt, tiêu đề đậm, một dòng chữ phụ. Thẻ chờ của đơn chưa
 * trả (G42) dùng lại cùng lưới, kể cả tông cảnh báo cho ô hạn trả.
 */
export function InfoCell({
  icon,
  title,
  warn = false,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Ô vuông icon tông cảnh báo — ô "Pay by …" của thẻ chờ. */
  warn?: boolean;
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
      <span
        className={cn(
          'grid size-9.5 place-items-center rounded-xl [&_svg]:size-4',
          warn ? 'bg-warning/20 text-warning-emphasis' : 'bg-primary/10 text-primary-emphasis',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground wrap-anywhere">{children}</p>
      </div>
    </div>
  );
}
