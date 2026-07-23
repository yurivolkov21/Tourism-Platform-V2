'use client';

import { CompassIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Convert từ Estate hero-sections.tsx: hero fullscreen ảnh + badge pill +
// heading giữa + 2 nút (nút phụ có hiệu ứng chữ trượt khi hover).
// Giữ nguyên timings spring của template; màu/hình sang token + ảnh mock.
export function Hero() {
  return (
    <motion.section
      id="top"
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-on-media"
      initial={{ opacity: 0.4 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {/* Placeholder nền (chính sách review #10 — ảnh thật thay sau) + scrim giữ nguyên */}
      <div className="dark absolute inset-0 -z-10">
        <ImagePlaceholder label="Hero — Ha Long Bay panorama" className="h-full w-full" />
        <div className="absolute inset-0 bg-overlay" />
      </div>

      <motion.div
        className="flex items-center gap-2 rounded-full border border-on-media/20 bg-on-media/20 py-1 pr-4 pl-2 text-sm backdrop-blur"
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
      >
        <CompassIcon className="size-4" aria-hidden="true" />
        <p>Small-group tours across Vietnam</p>
      </motion.div>

      <motion.h1
        className="mt-5 max-w-3xl text-center font-heading text-5xl leading-tight font-medium md:text-[64px]"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
      >
        Travel slow. The valley will wait.
      </motion.h1>

      <motion.p
        className="mt-3 max-w-120 text-center"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
      >
        Hand-picked journeys through limestone bays, terraced highlands, and lantern-lit old towns —
        led by people who grew up there.
      </motion.p>

      <motion.div
        className="mt-8 flex items-center gap-4"
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
      >
        <a
          href="#tours"
          className="cursor-pointer rounded-md bg-card px-6 py-2.5 text-sm font-medium text-card-foreground transition hover:bg-card/85"
        >
          View tours
        </a>
        <a
          href="#contact"
          className="group cursor-pointer rounded-md border border-on-media/40 px-5 py-2.5 text-sm font-medium transition"
        >
          {/* Hiệu ứng chữ trượt dọc khi hover — giữ nguyên từ template */}
          <span className="relative block overflow-hidden">
            <span className="block transition-transform duration-200 group-hover:-translate-y-full">
              Plan with us
            </span>
            <span className="absolute top-0 left-0 block translate-y-full transition-transform duration-200 group-hover:translate-y-0">
              Plan with us
            </span>
          </span>
        </a>
      </motion.div>
    </motion.section>
  );
}
