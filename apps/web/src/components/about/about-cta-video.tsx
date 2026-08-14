'use client';

import { ImagePlaceholder } from '@/components/image-placeholder';

// About §7 ứng viên B — convert ShadcnSpace CTA 02 "Video Background" (đang so
// với CTA 01 aurora): card bo trên 2xl nền VIDEO autoplay + nội dung trắng căn
// giữa + thanh marquee bo dưới 2xl chạy cam kết thương hiệu.
// Da thịt: teal-400 → bg-primary; marquee react-fast-marquee → cơ chế
// .animate-marquee-left hai toa của nhà (hover dừng, reduced-motion tắt);
// video theo chính sách placeholder — khung <video> sẵn trong comment, khi có
// media thật thì thay ImagePlaceholder bằng nó (nhớ autoPlay muted loop
// playsInline + poster, và tắt theo prefers-reduced-motion).
const MARQUEE_ITEMS = [
  'Small groups',
  'Local guides only',
  'Free cancellation up to 48h',
  'Three regions, one country',
  'No scripts, no rush',
];

// Một "toa" cam kết — hai toa giống hệt nối đuôi tạo loop kín (toa 2 ẩn a11y)
function PromiseGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex shrink-0 items-center gap-6 pr-6">
          <span className="text-sm whitespace-nowrap text-primary-foreground">{item}</span>
          <span aria-hidden="true" className="h-px w-8 bg-primary-foreground/50" />
        </span>
      ))}
    </span>
  );
}

export function AboutCtaVideo() {
  return (
    <section className="w-full px-4 py-8 sm:py-20 md:px-16">
      <div className="mx-auto max-w-7xl">
        {/* Card nền video (placeholder tới khi có media) + scrim + nội dung trắng */}
        <div className="relative flex min-h-96 items-center justify-center overflow-hidden rounded-t-2xl">
          <div className="dark absolute inset-0">
            {/* Khi có media: <video autoPlay loop muted playsInline poster="..."
                className="absolute inset-0 h-full w-full object-cover" /> */}
            <ImagePlaceholder
              corner
              label="Video — drone over Hạ Long at dawn (thay khi có media)"
              className="h-full w-full"
            />
            <div className="absolute inset-0 bg-overlay/60" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 px-10 py-16">
            <h2 className="max-w-2xl text-center font-heading text-3xl font-medium text-on-media sm:text-4xl">
              The road is ready
              <span className="italic"> when you are.</span>
            </h2>
            <a
              href="/#tours"
              className="rounded-full bg-card px-6 py-3.5 text-sm font-medium text-card-foreground transition-colors duration-300 hover:bg-card/85"
            >
              Browse the tours
            </a>
          </div>
        </div>

        {/* Thanh cam kết bo dưới — marquee cơ chế nhà, nền primary */}
        <div className="w-full overflow-hidden rounded-b-2xl border-t border-primary-foreground/10 bg-primary py-4">
          <div className="animate-marquee-left flex w-max">
            <PromiseGroup />
            <PromiseGroup hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
