'use client';

import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 3 tab khu account (hub `/account` gỡ theo spec 2026-08-10 AMENDED — 4 mục
 * < ngưỡng 6 của khảo sát, Trips nhận vai cửa chính). `security` chỉ redirect
 * 308 sang profile nên không có tab riêng — "đủ route không đủ tab", quyết
 * định giữ nguyên từ vòng 10/08 trước đó.
 */
const TABS = [
  { href: '/account/bookings', key: 'bookings' as const },
  { href: '/account/saved', key: 'saved' as const },
  { href: '/account/profile', key: 'profile' as const },
] as const;

/**
 * Tab nội khu — kiểu GẠCH CHÂN, không phải chip bo tròn (bản trước) và không
 * phải cột dọc (bản 10/08 đã bị bác).
 *
 * Vì sao gạch chân: chip có nền và viền riêng nên nó tự tạo một mép trái thứ
 * hai — chữ trong chip thụt vào so với mép container. Cột dọc còn tệ hơn, nó
 * thụt 32px. Gạch chân không có hộp, nên nhãn tab ĐẦU TIÊN bắt đầu đúng x của
 * mép container, trùng lề với H1, tiêu đề mục và đầu mọi đường kẻ bên dưới.
 * Đây là lý do kỹ thuật, không phải khẩu vị: cả khu account chỉ được có ba toạ
 * độ x, và mọi thứ có hộp riêng đều đẻ ra toạ độ thứ tư.
 *
 * Đặt TRÊN CÙNG, trước H1 của từng trang: thanh điều hướng phải đứng yên một
 * chỗ khi đổi tab. Để dưới H1 thì tiêu đề dài ngắn khác nhau sẽ đẩy nó nhấp
 * nhô giữa các trang.
 *
 * Nhãn dùng Literata (`font-heading`) — ba tab là ba NƠI, và địa danh trên
 * site này luôn viết bằng serif. Giữ `text-base`: H1 các trang con là
 * `text-2xl`, leo lên đó thì tab và tiêu đề trang thành hai dòng chữ ngang cỡ.
 *
 * KHÔNG dùng `Tabs`/`TabsList` của `@tourism/ui`: primitive đó điều khiển panel
 * bằng state trong MỘT trang, còn ở đây mỗi tab là một ROUTE thật — cần
 * `<Link>` + `aria-current`, không cần state machine.
 */
export function AccountNav() {
  const pathname = usePathname();
  const t = messages.accountNav;

  return (
    <nav aria-label={t.ariaLabel} className="border-b">
      {/* `-mx-4 px-4` ở màn nhỏ để dải tab cuộn được sát mép màn hình mà chữ
          vẫn thẳng lề nội dung. Từ `sm:` trả về 0 để tab đầu tiên trùng đúng
          mép container. */}
      <ul className="-mx-4 flex gap-x-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((tab) => {
          // Không còn tab route gốc `/account` (đã redirect sang bookings) nên
          // mọi tab đều so khớp cả path con — `/account/bookings/BK-XXXX` vẫn
          // sáng Trips.
          const isActive = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                // `-outline-offset-2` (offset ÂM): `ul` có `overflow-x-auto`,
                // vòng focus offset dương bị cắt ở tab đầu và tab cuối. Lỗi này
                // không hiện trong ảnh chụp, chỉ hiện khi tab bằng bàn phím.
                className={`relative block rounded-sm py-3 font-heading text-base whitespace-nowrap outline-ring transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ${
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t[tab.key]}
                {/* Gạch chân 2px ngồi ĐÈ lên ray 1px của `border-b` nhờ
                    `-bottom-px`. Rộng đúng bề rộng chữ vì `inset-x-0` của một
                    khối không padding ngang.
                    `primary-emphasis` chứ không `primary`: đo `primary` trên nền
                    tối chỉ 2.91:1, rớt mốc 3:1 của WCAG 1.4.11; `primary-emphasis`
                    ra 7.10. Xem đính chính ở ADR-0019 mục 2 về việc dùng token
                    này cho một hình đặc không cõng chữ. */}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-primary-emphasis"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
