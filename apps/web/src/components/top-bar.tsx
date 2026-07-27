import { MailIcon, PhoneIcon } from 'lucide-react';
import { FacebookIcon, InstagramIcon, TwitterIcon } from './icons/social';

// Convert từ TopBar của Nexora (Lily-style) + chỉnh theo review vòng 1 #6:
// bỏ khung max-w (nội dung giãn sát hai mép, hết cảm giác "co vào giữa"),
// tagline trái chạy marquee liên tục (keyframes trong globals.css, hover dừng,
// reduced-motion tắt). Email/phone mock — thay bằng site-config khi gắn API.
// 5 thông điệp riêng biệt luân phiên trong marquee (review vòng 1 #7) —
// mix định vị + khuyến mãi (khớp flag mock) + cam kết + tin mới.
const MESSAGES = [
  'Vietnam’s slow-travel journeys, crafted end to end by locals',
  'Autumn sale — 20% off selected Ha Long departures this week',
  'Small groups of twelve, always led by local guides',
  'Free cancellation up to 48 hours before departure',
  'New route: Mekong Delta Boats — two days on the river',
];
const EMAIL = 'hello@tourism.example';
const PHONE = '+84 24 3826 0126';

const SOCIALS = [
  { Icon: FacebookIcon, label: 'Facebook' },
  { Icon: InstagramIcon, label: 'Instagram' },
  { Icon: TwitterIcon, label: 'X' },
];

// Một "toa" marquee: chuỗi 5 thông điệp nối nhau — hai toa giống hệt tạo loop kín.
function MarqueeGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {MESSAGES.map((msg) => (
        <span key={msg} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap">{msg}</span>
          <span className="mx-8 opacity-50">✦</span>
        </span>
      ))}
    </span>
  );
}

// z-(--z-sticky) chứ KHÔNG phải z-(--z-toast): đây là thanh thông báo cố định,
// cùng tầng chrome với navbar — không phải toast. Toast được phép nằm trên
// modal; banner thì không. Ở mức toast (1700) nó đè lên cả drawer/dialog
// (1400) và cắt mất header của chúng — thấy thật ở drawer lọc /tours 27/07.
// Không xung đột với navbar dù cùng 1100: navbar dùng top-(--banner-offset)
// nên hai thứ không bao giờ chồng chỗ.
export function TopBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-(--z-sticky) bg-primary text-primary-foreground max-sm:hidden">
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
