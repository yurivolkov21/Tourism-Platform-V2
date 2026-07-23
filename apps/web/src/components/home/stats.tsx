'use client';

import { motion } from 'motion/react';
import { CountUp } from '@/components/motion/count-up';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate stats.tsx: headline lớn + mô tả + nút + 3 counter có vách ngăn.
export function Stats() {
  return (
    <section id="tours" className="w-full px-4 py-16 md:px-16 md:py-25 lg:px-24 xl:px-32">
      <div className="flex max-w-3xl flex-col items-start">
        <SectionEyebrow>Tours across Vietnam</SectionEyebrow>
        <motion.h2
          className="mt-8 max-w-[610px] font-heading text-5xl leading-tight text-foreground md:text-6xl"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Journeys shaped by the people who live them
        </motion.h2>

        <motion.p
          className="mt-3 max-w-[520px] text-sm text-muted-foreground md:text-base"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
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
          transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Explore tours
        </motion.a>
      </div>

      <div className="mt-16 flex max-w-4xl justify-between max-lg:flex-col max-lg:gap-10 md:mt-20">
        <div className="flex flex-col justify-center">
          <span className="min-w-[152px] font-heading text-4xl text-foreground tabular-nums md:text-5xl">
            <CountUp to={68} />+
          </span>
          <span className="mt-4 text-sm tracking-wide text-muted-foreground uppercase">
            Hand-picked tours
          </span>
        </div>

        <div className="h-20 w-px bg-border max-lg:hidden" />

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
    </section>
  );
}
