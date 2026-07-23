'use client';

import { MenuIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './logo';

// Convert từ Estate navbar.tsx: nav fixed trong suốt nằm trên hero (chữ sáng),
// cuộn quá 50px thì thu thành pill nổi bg blur (chữ theo theme). Link các trang
// chưa có trỏ anchor section — thay dần khi từng trang được user chốt.
const NAV_LINKS = [
  { label: 'Tours', href: '#tours' },
  { label: 'Destinations', href: '#gallery' },
  { label: 'Reviews', href: '#top' },
  { label: 'Contact', href: '#contact' },
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

        <div className="hidden items-center gap-6 text-sm md:flex md:gap-10">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          className={`hidden cursor-pointer rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-500 md:block ${
            scrolled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-card text-card-foreground hover:bg-card/85'
          }`}
        >
          Book a tour
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className={`cursor-pointer rounded-md p-2 transition md:hidden ${
            scrolled ? 'text-foreground' : 'text-on-media'
          }`}
        >
          <MenuIcon className="size-6" aria-hidden="true" />
        </button>
      </nav>

      {/* Overlay menu mobile — trượt ngang toàn màn, blur nền (pattern template) */}
      <div
        className={`${
          mobileOpen ? 'max-md:w-full' : 'max-md:w-0'
        } flex items-center gap-6 text-sm max-md:fixed max-md:top-0 max-md:left-0 max-md:z-(--z-overlay) max-md:h-full max-md:flex-col max-md:justify-center max-md:overflow-hidden max-md:bg-background/80 max-md:backdrop-blur-xl max-md:transition-all max-md:duration-300 md:hidden`}
      >
        {NAV_LINKS.map((l) => (
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
