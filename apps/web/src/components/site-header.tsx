'use client';

import { AnimatedThemeToggler } from '@tourism/ui/components/animated-theme-toggler';
import { MenuIcon, XIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DestinationsMenu } from './destinations-menu';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

// Convert từ Estate navbar.tsx: nav fixed trong suốt nằm trên hero (chữ sáng),
// cuộn quá 50px thì thu thành pill nổi bg blur (chữ theo theme).
// Nâng cấp review navbar (đối chiếu Nexora site-header): Destinations thành
// dropdown NavigationMenu · cụm action = AnimatedThemeToggler (magicui, lan
// tròn View Transitions) + UserMenu (Log in / avatar dropdown theo mock) +
// nút Book a tour. Mọi mảnh đều nhận "skin" theo 2 chế độ nền của navbar.
// Thứ tự theo Nexora (Tours · Destinations · Blog · About · Contact) — navbar
// chỉ chứa đích đến là TRANG thật (review navbar #3: bỏ Reviews vì nó mãi là
// section trong Home, link tới nó vẫn còn ở footer).
// 27/07: navbar KHÔNG còn link chết nào. Tours trỏ /tours; dropdown Destinations
// liệt kê 9 địa danh trỏ /tours?destinations=<slug> — SỐ NHIỀU, đúng từ vựng URL
// mà /tours đọc (xem comment trong destinations-menu.tsx: bản số ít mở trang mà
// không lọc gì).
const NAV_LINKS = [
  { label: 'Travel Blog', href: '/blog' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// Link phẳng cho overlay mobile. Không bung 9 địa danh ra đây — overlay là cột
// dọc căn giữa, thêm 9 mục là phải cuộn. Một mục Destinations trỏ /tours là đủ;
// người dùng lọc tiếp bằng toolbar ngay trên trang đó.
const MOBILE_LINKS = [
  { label: 'Tours', href: '/tours' },
  { label: 'Destinations', href: '/tours' },
  { label: 'Travel Blog', href: '/blog' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Log in', href: '/login' },
];

/**
 * Đường dẫn KHÔNG có hero tối phía sau navbar.
 *
 * Navbar lúc chưa cuộn dùng `on-media` (chữ sáng) vì nó giả định đang nằm trên
 * một mảng hero tối. Giả định đó đúng với mọi trang nội dung, nhưng SAI với
 * trang bù khoảng bằng `pt-36` mà không có hero thật. Hệ quả ở chế độ SÁNG:
 * chữ sáng trên nền sáng, navbar tàng hình cho tới khi người dùng cuộn xuống.
 * Ở chế độ tối thì tình cờ vẫn đọc được nên lỗi này sống sót lâu — chỉ lộ ra
 * khi chụp ảnh nghiệm thu chế độ sáng.
 *
 * **Danh sách này chỉ nên NGẮN đi, đừng dài thêm.** Hai lần trước đều giải
 * bằng cách cho trang một hero thật rồi rút nó khỏi đây, chứ không phải thêm
 * đường dẫn vào:
 *  · `/account` rời 11/08 — khu hộ chiếu có "BÌA" (dải `bg-hero` tối).
 *  · `/tours/[slug]/book` rời 19/08 — trang đặt chỗ nay dùng `TourHeroBoard`,
 *    và `/tours/[slug]/enquire` sinh ra cùng ngày cũng dùng nó nên KHÔNG bao
 *    giờ phải vào đây. Chính lần đó cho thấy vì sao luật đi-theo-đường-dẫn là
 *    sai hướng: `/enquire` ra đời là rách ngay, navbar tàng hình ở light mode
 *    (đo được: chữ `lab(97.7…)` trên nền sáng) mà không có gì báo.
 *
 * Dùng tiền tố đường dẫn thay vì một context: navbar nằm ở layout `(site)`,
 * TRÊN cây của các layout con, nên context từ dưới không với tới được nó.
 */
const HERO_LESS_PREFIXES = ['/checkout'];
/** Ngoại lệ trong tiền tố hero-less: `/checkout/success` CÓ hero chuẩn từ
 *  12/08 (góp ý user — trang voucher đồng bộ với phần còn lại của site);
 *  book/cancel của checkout vẫn hero-less như user đã duyệt ở cụm checkout. */
const HERO_LESS_EXCEPTIONS = ['/checkout/success'];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Trang không có hero thì navbar dùng LUÔN kiểu "đã cuộn" (nền đặc, chữ
  // `foreground`) ngay từ đầu — không có mảng tối nào để chữ sáng đứng lên.
  //
  // Nhánh riêng cho `/tours/*/book` đã XOÁ 19/08: trang đó có hero thật rồi.
  // Giờ chỉ còn so tiền tố, không còn khớp route con bằng `endsWith`.
  const isHeroLess =
    !HERO_LESS_EXCEPTIONS.some((prefix) => pathname.startsWith(prefix)) &&
    HERO_LESS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const onDarkHero = !isHeroLess;
  const solid = scrolled || !onDarkHero;

  const linkClass = `transition-colors duration-500 ${
    solid ? 'text-foreground hover:text-muted-foreground' : 'text-on-media hover:text-on-media/90'
  }`;

  // Trigger dropdown đồng bộ với link trần bên cạnh (review navbar #2): LỘT
  // hết nền muted mặc định của navigationMenuTriggerStyle ở mọi trạng thái —
  // hover chỉ đổi màu chữ như các link khác, tự khớp light/dark theo token.
  const triggerSkin = `h-auto bg-transparent px-0 py-0 font-normal hover:bg-transparent focus:bg-transparent data-open:bg-transparent data-popup-open:bg-transparent data-open:hover:bg-transparent data-popup-open:hover:bg-transparent ${
    solid
      ? 'text-foreground hover:text-muted-foreground data-open:text-muted-foreground'
      : 'text-on-media hover:text-on-media/90 data-open:text-on-media/90'
  }`;
  const iconButtonClass = `flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-500 [&_svg]:size-4.5 ${
    solid ? 'text-foreground hover:bg-muted' : 'text-on-media hover:bg-on-media/10'
  }`;

  return (
    <>
      <nav
        className={`fixed top-(--banner-offset) left-1/2 z-(--z-sticky) flex -translate-x-1/2 items-center justify-between p-4 transition-all duration-500 ${
          scrolled
            ? 'mt-4 w-[calc(100vw-14px)] rounded-full bg-background/60 pl-6 shadow-(--shadow-dropdown) backdrop-blur-2xl lg:w-5xl'
            : 'w-full md:px-16 lg:px-24 xl:px-32'
        }`}
      >
        <a href="/" aria-label="Nexora — home">
          {/* Trên hero (chưa cuộn) logo phải sáng: ép màu qua class dark-scope */}
          <span className={solid ? '' : 'dark'}>
            <Logo />
          </span>
        </a>

        <div className="hidden items-center gap-2 text-sm md:flex lg:gap-6">
          <a href="/tours" className={linkClass}>
            Tours
          </a>
          <DestinationsMenu triggerClassName={`text-sm font-normal ${triggerSkin}`} />
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <AnimatedThemeToggler className={iconButtonClass} />
          <UserMenu linkClassName={`px-2 text-sm ${linkClass}`} />
          {/* LINK thật tới /tours (user báo 19/08: nút không làm gì — tàn dư
              `<button>` static-first không handler). "Book a tour" = chọn tour
              để đặt, nên đích là catalogue; trang chi tiết mới có nút Reserve. */}
          <a
            href="/tours"
            // `solid`, KHÔNG phải `scrolled`: nền `bg-card` gần-trắng chỉ nổi khi
            // đứng trên hero tối. Trên trang không hero ở chế độ sáng nó là
            // trắng-trên-trắng, nên dùng nút primary đặc.
            className={`inline-flex cursor-pointer items-center rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-500 ${
              solid
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-card text-card-foreground hover:bg-card/85'
            }`}
          >
            Book a tour
          </a>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <AnimatedThemeToggler className={iconButtonClass} />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className={`cursor-pointer rounded-md p-2 transition ${
              solid ? 'text-foreground' : 'text-on-media'
            }`}
          >
            <MenuIcon className="size-6" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Overlay menu mobile — trượt ngang toàn màn, blur nền (pattern template) */}
      <div
        className={`${
          mobileOpen ? 'max-md:w-full' : 'max-md:w-0'
        } flex items-center gap-5 text-sm max-md:fixed max-md:top-0 max-md:left-0 max-md:z-(--z-overlay) max-md:h-full max-md:flex-col max-md:justify-center max-md:overflow-hidden max-md:bg-background/80 max-md:backdrop-blur-xl max-md:transition-all max-md:duration-300 md:hidden`}
      >
        {MOBILE_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            className="text-lg font-medium text-foreground"
          >
            {l.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="cursor-pointer rounded-md bg-card p-2 text-card-foreground"
        >
          <XIcon className="size-6" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
