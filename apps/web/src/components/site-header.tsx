'use client';

import { AnimatedThemeToggler } from '@tourism/ui/components/animated-theme-toggler';
import { MenuIcon, XIcon } from 'lucide-react';
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
// section trong Home, link tới nó vẫn còn ở footer). Travel Blog nay trỏ
// thẳng /blog (Task 7) — trang /about cũng đã có, không còn link tạm nào.
// Anchor dạng TUYỆT ĐỐI (/#...) — đứng ở /about bấm vẫn về đúng section Home
const NAV_LINKS = [
  { label: 'Travel Blog', href: '/blog' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// Link phẳng cho overlay mobile — bung Destinations thành từng vùng (kiểu Nexora)
const MOBILE_LINKS = [
  { label: 'Tours', href: '/#tours' },
  { label: 'Destinations — North', href: '/#gallery' },
  { label: 'Destinations — Central', href: '/#gallery' },
  { label: 'Destinations — South', href: '/#gallery' },
  { label: 'Travel Blog', href: '/blog' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Log in', href: '/login' },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linkClass = `transition-colors duration-500 ${
    scrolled
      ? 'text-foreground hover:text-muted-foreground'
      : 'text-on-media hover:text-on-media/90'
  }`;

  // Trigger dropdown đồng bộ với link trần bên cạnh (review navbar #2): LỘT
  // hết nền muted mặc định của navigationMenuTriggerStyle ở mọi trạng thái —
  // hover chỉ đổi màu chữ như các link khác, tự khớp light/dark theo token.
  const triggerSkin = `h-auto bg-transparent px-0 py-0 font-normal hover:bg-transparent focus:bg-transparent data-open:bg-transparent data-popup-open:bg-transparent data-open:hover:bg-transparent data-popup-open:hover:bg-transparent ${
    scrolled
      ? 'text-foreground hover:text-muted-foreground data-open:text-muted-foreground'
      : 'text-on-media hover:text-on-media/90 data-open:text-on-media/90'
  }`;
  const iconButtonClass = `flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-500 [&_svg]:size-4.5 ${
    scrolled ? 'text-foreground hover:bg-muted' : 'text-on-media hover:bg-on-media/10'
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
        <a href="/" aria-label="tourism — home">
          {/* Trên hero (chưa cuộn) logo phải sáng: ép màu qua class dark-scope */}
          <span className={scrolled ? '' : 'dark'}>
            <Logo />
          </span>
        </a>

        <div className="hidden items-center gap-2 text-sm md:flex lg:gap-6">
          <a href="/#tours" className={linkClass}>
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
          <button
            type="button"
            className={`cursor-pointer rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-500 ${
              scrolled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-card text-card-foreground hover:bg-card/85'
            }`}
          >
            Book a tour
          </button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <AnimatedThemeToggler className={iconButtonClass} />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className={`cursor-pointer rounded-md p-2 transition ${
              scrolled ? 'text-foreground' : 'text-on-media'
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
