import { MailIcon, PhoneIcon } from 'lucide-react';
import { FacebookIcon, InstagramIcon, TwitterIcon } from './icons/social';

// Convert từ TopBar của Nexora (Lily-style) + chỉnh theo review vòng 1 #6:
// bỏ khung max-w (nội dung giãn sát hai mép, hết cảm giác "co vào giữa"),
// tagline trái chạy marquee liên tục (keyframes trong globals.css, hover dừng,
// reduced-motion tắt). Email/phone mock — thay bằng site-config khi gắn API.
const TAGLINE = 'Vietnam’s slow-travel journeys, crafted end to end by locals';
const EMAIL = 'hello@tourism.example';
const PHONE = '+84 24 3826 0126';

const SOCIALS = [
  { Icon: FacebookIcon, label: 'Facebook' },
  { Icon: InstagramIcon, label: 'Instagram' },
  { Icon: TwitterIcon, label: 'X' },
];

// Một "toa" marquee: tagline + dấu ngăn, lặp vài lần cho đủ dài hơn mọi khung nhìn.
function MarqueeGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {Array.from({ length: 3 }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: chuỗi lặp tĩnh, không reorder
          key={i}
          className="flex shrink-0 items-center"
        >
          <span className="whitespace-nowrap">{TAGLINE}</span>
          <span className="mx-8 opacity-50">✦</span>
        </span>
      ))}
    </span>
  );
}

export function TopBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-(--z-toast) bg-primary text-primary-foreground max-sm:hidden">
      <div className="flex h-9 w-full items-center justify-between gap-8 px-4 text-xs sm:px-6 lg:px-10">
        {/* Tagline chạy liên tục — bản sao thứ hai chỉ để loop, ẩn khỏi a11y tree */}
        <div className="relative flex-1 overflow-hidden text-primary-foreground/85">
          <div className="animate-marquee-left flex w-max">
            <MarqueeGroup />
            <MarqueeGroup hidden />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-5">
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
