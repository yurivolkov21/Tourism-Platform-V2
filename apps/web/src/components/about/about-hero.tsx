'use client';

import { CompassIcon, MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { CountUp } from '@/components/motion/count-up';

// About §1 (convert 100% lối forged/Hero, da thịt token + bài học #25):
// hero fullscreen căn TRÁI — badge pill viền accent, heading 3 dòng reveal
// từng dòng (overflow-hidden, y:120→0, ease điện ảnh của forged), dòng giữa
// accent italic thay ALL-CAPS 900; mô tả + 2 nút (primary glow / outline);
// hàng 3 stat trên border hairline (CountUp spring thay chữ tĩnh); chỉ báo
// "Scroll" dọc góc phải. Chạy animate lúc mount (trên màn đầu, không whileInView).
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

// Số liệu công ty mock (static-first) — sau này một phần lấy từ API catalog
// như Nexora about-metrics; phần "năm hoạt động" là hằng số brand.
const HERO_STATS = [
  { value: 12, suffix: '+', label: 'Years on the road' },
  { value: 8000, suffix: '+', label: 'Travellers hosted' },
  { value: 98, suffix: '%', label: 'Would go again' },
];

function RevealLine({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden">
      <motion.span
        className="block"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay, ease: REVEAL_EASE }}
      >
        {children}
      </motion.span>
    </div>
  );
}

export function AboutHero() {
  return (
    <section className="relative flex min-h-screen w-full items-center overflow-hidden text-on-media">
      {/* Nền: placeholder + gradient trái→phải như forged (chữ nằm bên trái) */}
      <div className="dark absolute inset-0 -z-10">
        <ImagePlaceholder
          corner
          label="About hero — guide leading trekkers, Sa Pa"
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-linear-to-r from-overlay via-overlay/60 to-transparent" />
      </div>

      <div className="dark w-full px-4 pt-28 pb-12 md:px-16 lg:px-24 xl:px-32">
        {/* Badge pill viền accent */}
        <motion.div
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 backdrop-blur-sm"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <CompassIcon className="size-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium tracking-widest text-primary uppercase">
            The people behind the paths
          </span>
        </motion.div>

        {/* Heading 3 dòng reveal từng dòng — dòng giữa accent italic */}
        <h1 className="mb-8 font-heading text-5xl leading-[1.05] font-medium tracking-tight text-foreground md:text-6xl xl:text-7xl">
          <RevealLine delay={0.3}>Slow travel,</RevealLine>
          <RevealLine delay={0.45}>
            <span className="text-primary italic">crafted by locals,</span>
          </RevealLine>
          <RevealLine delay={0.6}>since 2014.</RevealLine>
        </h1>

        <motion.div
          className="mt-4 flex flex-col gap-6"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
        >
          <p className="max-w-md text-base leading-relaxed text-foreground/60">
            tourism began as three guides and one minivan in Sa Pa. Today we run small-group
            journeys across all three regions — still no scripts, still no rush.
          </p>
          <div className="flex items-center gap-4">
            <motion.a
              href="/#tours"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="group flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-shadow duration-300 hover:shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_40%,transparent)]"
            >
              <span>Browse tours</span>
              <MoveRightIcon
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </motion.a>
            <motion.a
              href="#team"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 hover:border-foreground/50"
            >
              Meet the team
            </motion.a>
          </div>
        </motion.div>

        {/* Hàng 3 stat trên hairline — CountUp spring */}
        <motion.div
          className="mt-12 flex items-center gap-12 border-t border-foreground/10 pt-7"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.05 }}
        >
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className="font-heading text-3xl leading-none font-semibold text-primary">
                <CountUp to={stat.value} delay={1.1} />
                {stat.suffix}
              </span>
              <span className="mt-1 text-xs tracking-wide text-foreground/50 uppercase">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Chỉ báo cuộn dọc góc phải */}
      <motion.div
        className="dark absolute right-8 bottom-8 z-10 flex flex-col items-center gap-2 md:right-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        <span
          aria-hidden="true"
          className="h-16 w-px bg-linear-to-b from-transparent to-primary/60"
        />
        <span className="origin-center translate-x-4 rotate-90 text-[10px] tracking-widest text-foreground/40 uppercase">
          Scroll
        </span>
      </motion.div>
    </section>
  );
}
