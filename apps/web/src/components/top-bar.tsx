import { MailIcon, PhoneIcon } from 'lucide-react';
import { FacebookIcon, InstagramIcon, TwitterIcon } from './icons/social';

// Convert từ TopBar của Nexora (Lily-style, user chọn thay Dark Action Banner —
// review vòng 1 #5): dải utility mỏng TRÊN navbar — tagline trái, liên hệ +
// social phải. Nền primary jade, KHÔNG có nút đóng, ẩn trên mobile cho gọn
// (--banner-offset trong globals.css cũng responsive theo).
// Email/phone là mock (static-first) — thay bằng site-config khi gắn API.
const EMAIL = 'hello@tourism.example';
const PHONE = '+84 24 3826 0126';

const SOCIALS = [
  { Icon: FacebookIcon, label: 'Facebook' },
  { Icon: InstagramIcon, label: 'Instagram' },
  { Icon: TwitterIcon, label: 'X' },
];

export function TopBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-(--z-toast) bg-primary text-primary-foreground max-sm:hidden">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-6 px-4 text-xs sm:px-6 lg:px-8">
        <p className="truncate text-primary-foreground/85">
          Vietnam’s slow-travel journeys, crafted end to end by locals
        </p>

        <div className="flex items-center gap-5">
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-1.5 text-primary-foreground/85 transition-colors hover:text-primary-foreground max-md:hidden"
          >
            <MailIcon className="size-3.5" aria-hidden="true" />
            {EMAIL}
          </a>
          <a
            href={`tel:${PHONE.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1.5 text-primary-foreground/85 transition-colors hover:text-primary-foreground"
          >
            <PhoneIcon className="size-3.5" aria-hidden="true" />
            {PHONE}
          </a>
          <div className="h-4 w-px bg-primary-foreground/25" />
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ Icon, label }) => (
              <a
                key={label}
                href="#top"
                aria-label={label}
                className="text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
