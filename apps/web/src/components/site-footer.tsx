import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Logo } from './logo';

// Footer tối ở CẢ hai theme: class `dark` đặt lại toàn bộ token trong phạm vi
// footer (không hex — vẫn tokens-only). Link trang chưa có trỏ #.
export function SiteFooter() {
  return (
    <footer className="dark bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-(--container-content) gap-10 px-6 py-14 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Small-group tours across Vietnam, led by people who grew up there.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm">
          {/* Trang đích chưa tồn tại — anchor tạm theo section, thay khi từng trang được chốt. */}
          {[
            ['Tours', '#tours'],
            ['Destinations', '#regions'],
            ['Journal', '#journal'],
            ['About', '#top'],
            ['Contact', '#top'],
            ['Terms', '#top'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <form className="flex flex-col gap-3" action="#">
          <p className="text-sm font-medium">Get three itineraries in your inbox</p>
          <div className="flex gap-2">
            <Input type="email" placeholder="you@example.com" aria-label="Email" />
            <Button type="button" variant="secondary">
              Subscribe
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">No spam. Unsubscribe anytime.</p>
        </form>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-(--container-content) px-6 py-4 text-xs text-muted-foreground">
          © 2026 tourism. Photos: Wikimedia Commons contributors & Unsplash (see credits).
        </p>
      </div>
    </footer>
  );
}
