import { Button } from '@tourism/ui/components/button';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';

// Link các trang CHƯA tồn tại trỏ # (đổi dần khi từng trang được user chốt).
const NAV_LINKS = [
  { label: 'Tours', href: '#tours' },
  { label: 'Destinations', href: '#regions' },
  { label: 'Journal', href: '#journal' },
  { label: 'About', href: '#top' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-(--container-content) items-center gap-6 px-6">
        <a href="/" aria-label="tourism — home">
          <Logo />
        </a>
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button className="hidden md:inline-flex">Book a tour</Button>
          <MobileMenu links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
