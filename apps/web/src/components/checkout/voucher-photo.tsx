import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarIcon, UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SlotImage } from '@/components/slot-image';
import { formatBookingMoney } from '@/lib/checkout';
import { VOUCHER_PHOTO_SIZES } from '@/lib/voucher-layout';

/**
 * Thẻ ảnh bìa lớn của cột trái — MỘT linh kiện cho voucher (`VoucherOverview`) và thẻ chờ của đơn
 * chưa trả (`PendingOverview`, G42): kicker "{nơi} · {n} days", tên tour, tổng tiền, chip ngày đi và
 * số khách × đơn giá. Tách khỏi `VoucherOverview` để hai thẻ không chép lớp phủ chữ đã đo tương phản.
 *
 * `sizes` theo đúng bề rộng ô ảnh (review P7C#12), dựng từ lề trang và đệm thẻ ở
 * `lib/voucher-layout.ts` (G35) — hai thẻ dùng cùng lề trang và cùng đệm cột trái, nên một chuỗi
 * đúng cho cả hai. Không `priority`: ở điện thoại ảnh nằm dưới mép gập (dưới hero, tiêu đề, ô mã),
 * nạp sớm chỉ giành băng thông của thứ khách thấy trước.
 */
export function VoucherPhoto({
  booking,
  place,
  tripDays,
  departure,
  dimmed = false,
  className,
}: {
  booking: BookingDetail;
  /** Điểm đến đầu tiên, không có thì tên tour (`tripPlace`). */
  place: string;
  tripDays: number;
  /** Ngày đi đã định dạng — một ngày hay một khoảng. */
  departure: string;
  /** Ảnh xám — đơn chưa trả không còn trả được trên trang này (G42). Lớp phủ chữ giữ nguyên. */
  dimmed?: boolean;
  className?: string;
}) {
  const t = messages.voucher;
  return (
    // Chiều cao TỐI THIỂU, không cố định: khối chữ nằm trong luồng và xếp ở đáy (flex
    // `justify-end`), nên chữ nhiều thì đẩy ảnh cao lên. Bản cũ cao cố định 224px còn khối chữ neo
    // đáy, nên ở 375px tên tour thật dài nhất của seed ("Northern Highlights: Hanoi–Hạ Long–Ninh
    // Bình 5D4N") tràn qua mép trên và bị `overflow-hidden` cắt mất dòng đầu.
    <div
      data-slot="voucher-photo"
      className={cn(
        'relative flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl bg-muted md:min-h-72',
        className,
      )}
    >
      <SlotImage
        image={booking.tourImage}
        className={cn('absolute inset-0', dimmed && 'grayscale')}
        sizes={VOUCHER_PHOTO_SIZES}
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
          {t.photoKicker(place, tripDays)}
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <p className="font-heading text-2xl leading-tight font-semibold">{booking.tourTitle}</p>
          <p className="shrink-0 font-mono text-xl font-semibold tabular-nums">
            {formatBookingMoney(booking, booking.totalAmount)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GlassChip icon={<CalendarIcon aria-hidden="true" />}>{departure}</GlassChip>
          <GlassChip icon={<UsersIcon aria-hidden="true" />}>
            {t.partyPrice(
              messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
              formatBookingMoney(booking, booking.unitPrice),
            )}
          </GlassChip>
        </div>
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
