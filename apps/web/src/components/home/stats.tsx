'use client';

import type { MediaItem } from '@tourism/contract';
import { motion } from 'motion/react';
import { CountUp } from '@/components/motion/count-up';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { SectionEyebrow } from './section-eyebrow';
import { StatsSlider } from './stats-slider';

// Convert từ Estate stats.tsx: headline lớn + mô tả + nút + 3 counter có vách ngăn.
export function Stats({
  toursCount,
  momentCovers,
}: {
  toursCount: number | null;
  /** `tourSlug` → cover, cho slider khoảnh khắc bên cột phải. */
  momentCovers?: Record<string, MediaItem | null>;
}) {
  return (
    <section id="tours" className="w-full px-4 py-16 md:px-16 md:py-25 lg:px-24 xl:px-32">
      {/* 2 cột (review #9): trái giữ nguyên thiết kế Estate, phải lấp bằng hover-expand gallery */}
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex justify-center">
          <div className="flex w-full flex-col items-start">
            <SectionEyebrow>Tours across Vietnam</SectionEyebrow>
            <motion.h2
              className="mt-8 max-w-[610px] font-heading text-5xl leading-tight text-foreground md:text-6xl"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={SPRING_HEADING}
            >
              Journeys shaped by the people who live them
            </motion.h2>

            <motion.p
              className="mt-3 max-w-[520px] text-sm text-muted-foreground md:text-base"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: 0.2 }}
            >
              From misty terraces in the north to river markets in the delta — every route is
              researched, walked, and retold by local guides before it reaches you.
            </motion.p>

            <motion.a
              href="#gallery"
              className="mt-7 cursor-pointer rounded-full bg-primary px-7 py-3 text-sm text-primary-foreground transition hover:bg-primary/90"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={SPRING}
            >
              Explore tours
            </motion.a>

            <div className="mt-16 flex w-full justify-between max-lg:flex-col max-lg:gap-10 md:mt-20">
              {/* Quyết định user 01/08 (vụ thứ 3 lớp Destinations-9): số tour phải
                  có nguồn API thật, KHÔNG hardcode "68+" nữa — 68 là số bịa. Suffix
                  là số TRẦN "30", không dấu "+", vì đây là con số CHÍNH XÁC (khác
                  các ô editorial 12,400+/98% bên dưới, vẫn là số tròn/ước lượng).
                  `toursCount` null khi fetch lỗi → ẨN HẲN ô này, cấm rơi về 68 cũ. */}
              {toursCount !== null ? (
                <>
                  <div className="flex flex-col justify-center">
                    <span className="min-w-[152px] font-heading text-4xl text-foreground tabular-nums md:text-5xl">
                      <CountUp to={toursCount} />
                    </span>
                    <span className="mt-4 text-sm tracking-wide text-muted-foreground uppercase">
                      Hand-picked tours
                    </span>
                  </div>

                  <div className="h-20 w-px bg-border max-lg:hidden" />
                </>
              ) : null}

              <div className="flex flex-col justify-center">
                <span className="min-w-[200px] font-heading text-4xl text-foreground tabular-nums md:text-5xl">
                  <CountUp to={12400} />+
                </span>
                <span className="mt-4 text-sm tracking-wide text-muted-foreground uppercase">
                  Happy travelers
                </span>
              </div>

              <div className="h-20 w-px bg-border max-lg:hidden" />

              <div className="flex flex-col justify-center">
                <span className="min-w-[94px] font-heading text-4xl text-foreground tabular-nums md:text-5xl">
                  <CountUp to={98} />%
                </span>
                <span className="mt-4 text-sm tracking-wide text-muted-foreground uppercase">
                  Traveler satisfaction
                </span>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="flex items-center justify-center max-lg:order-last"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ ...SPRING, delay: 0.2 }}
        >
          <StatsSlider covers={momentCovers} />
        </motion.div>
      </div>
    </section>
  );
}
