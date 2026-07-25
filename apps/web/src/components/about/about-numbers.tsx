'use client';

import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { CountUp } from '@/components/motion/count-up';
import { TopoPattern } from '@/components/topo-pattern';
import { REGIONS } from '@/mocks/regions';

// About §4 By the numbers (convert 100% lối forged/Stats, da thịt token):
// beat TỐI của trang (scope dark cố định như CTA/footer) — chữ nền "NUMBERS"
// khổng lồ mờ (tái dùng kỹ thuật .footer-watermark, cùng giọng watermark
// "tourism" cuối trang), lưới 6 ô hairline (gap-px trên nền border), hover ô
// sáng nhẹ + số phóng 1.05 từ mép trái, vào so le 0.1s. Counter dùng CountUp
// spring nhà thay AnimatedCounter rAF của template.
// Bộ 6 số ĐÀO SÂU VẬN HÀNH — cố ý không lặp 12+/8,000+/98% của hero §1.
// Mock static-first: tours/destinations/guides sẽ derive từ API catalog (như
// Nexora ByTheNumbers, ISR 300s) + bảng team_members tương lai.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

// Số tour derive từ REGIONS — một nguồn sự thật với gallery/destinations
// (vá mâu thuẫn 96 hardcode ≠ 68 tổng mock, phát hiện khi thêm Gallery 01)
const TOTAL_TOURS = REGIONS.reduce((acc, r) => acc + r.tourCount, 0);

const STATS = [
  {
    value: TOTAL_TOURS,
    suffix: '',
    label: 'Tours running',
    description: 'Across all three regions',
  },
  { value: 27, suffix: '', label: 'Local guides', description: 'Every one born on their route' },
  { value: 9, suffix: '', label: 'Destinations', description: 'Three per region, north to south' },
  {
    value: 560,
    suffix: '+',
    label: 'Departures a year',
    description: 'Rain or shine, twelve seats',
  },
  {
    value: 45000,
    suffix: '+',
    label: 'Kilometres each season',
    description: 'By road, rail and river',
  },
  { value: 0, suffix: '', label: 'Scripts', description: 'And none planned' },
];

export function AboutNumbers() {
  return (
    <section
      id="numbers"
      className="dark relative w-full overflow-hidden border-y bg-background px-4 py-24 text-foreground md:px-16 md:py-32"
    >
      {/* Nền ảnh mờ + scrim (góp ý §4 lần 2) — công thức CTA banner lai
          watermark; placeholder thay ảnh thật khi chốt trang */}
      <div aria-hidden="true" className="absolute inset-0">
        <ImagePlaceholder
          corner
          label="Numbers backdrop — mountain road at dusk"
          className="h-full w-full opacity-30"
        />
        <div className="absolute inset-0 bg-overlay/70" />
        {/* Gia vị topo (demo 25/07): lớp trắc địa rất nhạt giữa ảnh và watermark */}
        <TopoPattern className="bg-foreground opacity-[0.04]" />
      </div>

      {/* Chữ nền khổng lồ — neo giữa-dưới, chìm sau lưới (không che header) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-hidden select-none"
      >
        <span className="footer-watermark translate-y-[12%] font-heading text-[26vw] leading-none font-semibold tracking-tighter md:text-[18vw]">
          NUMBERS
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-16 flex flex-col items-center text-center">
          <SectionEyebrow>Key metrics</SectionEyebrow>
          <motion.h2
            className="mt-4 max-w-xl font-heading text-3xl leading-tight font-medium md:text-[40px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            Numbers we’re proud of,
            <br />
            <span className="text-primary italic">counted the slow way.</span>
          </motion.h2>
        </div>

        {/* Lưới hairline: gap-px trên nền border tạo kẻ mảnh 1px giữa các ô */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="group bg-background/85 p-8 backdrop-blur-md transition-colors duration-300 hover:bg-muted/60 md:p-12"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              <span className="mb-2 block origin-left font-heading text-5xl leading-none font-semibold text-primary transition-transform duration-300 group-hover:scale-105">
                <CountUp to={stat.value} />
                {stat.suffix}
              </span>
              <p className="mb-1 text-sm font-semibold tracking-wide uppercase">{stat.label}</p>
              <p className="text-xs text-foreground/40">{stat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
