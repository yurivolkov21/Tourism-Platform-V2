import type { Booking, WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { HeartIcon, TicketIcon, UserRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { daysUntilDeparture, groupBookingsByTime, nextTrip } from '@/lib/account-stats';

/**
 * Hub `/account` — bốn KHỐI thay vì danh sách mục (redesign 11/08).
 *
 * Khuôn lấy từ màn "Account" của Airbnb user gửi làm chuẩn: trang gốc không
 * hiện dữ liệu chi tiết, nó hiện những NƠI có thể đi tới, mỗi nơi một khối có
 * icon, tiêu đề, một dòng mô tả. Các trang con mới là chỗ đọc dữ liệu — và
 * chúng theo màn "Personal info" của cùng bộ ảnh.
 *
 * Khác Airbnb đúng một điểm, và là điểm khiến hub này đáng tồn tại: mỗi khối
 * cõng thêm một dòng SỐ LIỆU THẬT. Airbnb để mô tả tĩnh vì họ có chín khu; ta
 * có ba, nên ba khối mô tả suông sẽ mỏng hơn một danh sách link thường.
 *
 * Khối "chuyến kế tiếp" nằm riêng ở hàng đầu và CHỈ hiện khi có chuyến đã trả
 * tiền phía trước. Nó không phải nơi để đi tới mà là câu trả lời cho câu hỏi
 * người ta thật sự mở trang này để hỏi — "tôi sắp đi đâu, còn mấy hôm".
 */

/** Bốn mốc thời gian dùng chung cho cả countdown lẫn nhãn — xem `Countdown`. */
function countdownLabel(startDate: string) {
  const t = messages.accountDashboard.nextTrip;
  const days = daysUntilDeparture(startDate);
  if (days === 0) return { big: null, text: t.today };
  if (days === 1) return { big: null, text: t.tomorrow };
  return { big: days, text: t.daysAway };
}

export function AccountHub({
  bookings,
  wishlist,
  email,
}: {
  bookings: Booking[];
  wishlist: WishlistItem[];
  email: string;
}) {
  const t = messages.accountDashboard;
  const h = t.hub;
  const trip = nextTrip(bookings);
  const grouped = groupBookingsByTime(bookings);
  // Chỉ đếm chuyến CÒN TREO VIỆC để làm dòng cảnh báo — tổng số booking là con
  // số phù phiếm, nó không nói người dùng cần làm gì.
  const awaiting = bookings.filter((b) => b.status === 'PENDING').length;

  const BLOCKS = [
    {
      href: '/account/bookings',
      Icon: TicketIcon,
      title: h.trips.title,
      desc: h.trips.desc,
      meta: awaiting > 0 ? h.awaiting(awaiting) : h.tripCount(bookings.length),
      urgent: awaiting > 0,
    },
    {
      href: '/account/saved',
      Icon: HeartIcon,
      title: h.saved.title,
      desc: h.saved.desc,
      meta: h.savedCount(wishlist.length),
      urgent: false,
    },
    {
      href: '/account/profile',
      Icon: UserRoundIcon,
      title: h.profile.title,
      desc: h.profile.desc,
      // Email thay cho một con số — khối này không có gì để đếm, mà im lặng
      // cạnh hai khối đang nói thì đọc như lỗi tải chứ không như chủ ý.
      meta: email,
      urgent: false,
    },
  ] as const;

  const cd = trip ? countdownLabel(trip.departureStartDate) : null;

  return (
    <div className="flex flex-col gap-4">
      {trip && cd ? (
        // Khối chuyến kế tiếp — nằm ngang cả hàng, là SỐ LỚN DUY NHẤT của cả
        // khu account. Cho hai số lớn là không còn số nào lớn.
        <Link
          href={`/account/bookings/${trip.code}`}
          className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-6 outline-ring transition-colors hover:border-primary-emphasis/40 focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-row sm:items-center"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase">
              {t.nextTrip.heading}
            </span>
            <span className="mt-2 block font-heading text-xl font-medium text-foreground">
              {trip.tourTitle}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground tabular-nums">
              {t.nextTrip.departing(trip.departureStartDate)} ·{' '}
              {t.nextTrip.travellers(trip.numAdults + trip.numChildren)}
            </span>
          </span>
          <span className="shrink-0 sm:text-right">
            {cd.big === null ? (
              <span className="block font-heading text-lg font-medium text-primary-emphasis">
                {cd.text}
              </span>
            ) : (
              <>
                <span className="block font-heading text-4xl font-medium text-primary-emphasis tabular-nums">
                  {cd.big}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{cd.text}</span>
              </>
            )}
          </span>
        </Link>
      ) : null}

      {/* Ba khối đích. `sm:grid-cols-2 lg:grid-cols-3` — ở lg mỗi khối rộng
          (1184 − 2×16)/3 = 384px, vẫn nằm trong lưới container, không đẻ toạ độ
          mới ở hai mép ngoài. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCKS.map(({ href, Icon, title, desc, meta, urgent }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-2xl border bg-card p-6 outline-ring transition-colors hover:border-primary-emphasis/40 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Icon aria-hidden="true" className="size-5 text-primary-emphasis" strokeWidth={1.5} />
            <span className="mt-4 block font-heading text-lg font-medium text-foreground">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{desc}</span>
            {/* Dòng số liệu đẩy xuống ĐÁY khối bằng `mt-auto` để ba khối có
                chân thẳng hàng dù mô tả dài ngắn khác nhau. */}
            {meta ? (
              <span
                className={`mt-auto truncate pt-4 font-mono text-[0.625rem] tracking-[0.16em] tabular-nums ${
                  // Email KHÔNG viết hoa: `uppercase` biến địa chỉ thật thành
                  // thứ không copy đúng được và đọc sai bằng trình đọc màn hình.
                  href === '/account/profile' ? '' : 'uppercase'
                } ${urgent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
              >
                {meta}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Nhóm "đang đi" là tin khẩn nhất mà ba khối trên không nói được — nó
          không phải một nơi để đi tới, nên đứng riêng dưới dạng một dòng chữ. */}
      {grouped.onTheRoad.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {messages.accountBookings.groups.onTheRoad}
          {' — '}
          <Link
            href="/account/bookings"
            className="text-primary-emphasis underline-offset-4 hover:underline"
          >
            {grouped.onTheRoad[0]?.tourTitle}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
