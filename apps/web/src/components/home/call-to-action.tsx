'use client';

import { MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Review #21 (phương án A): thay CTA cột-giữa của Estate bằng banner tràn viền
// convert từ forged/CTABanner — nền ảnh phủ kín + scrim tối + nội dung căn giữa
// + 2 nút (primary + outline). Khoảng trống hai bên biến mất vì nền ảnh chính
// là nội dung. Nền dùng dark-scope + ImagePlaceholder như hero (ảnh thật thay
// sau khi trang chốt); gradient nhấn từ token primary thay neon hardcode.
export function CallToAction() {
  return (
    <section className="relative w-full overflow-hidden py-28 text-on-media md:py-36">
      {/* Nền banner: placeholder + scrim + vệt gradient nhấn màu chủ đạo */}
      <div className="dark absolute inset-0 -z-10">
        <ImagePlaceholder corner label="Banner — Mekong delta at dusk" className="h-full w-full" />
        <div className="absolute inset-0 bg-overlay" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-br from-primary/25 via-transparent to-transparent"
        />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
        <motion.span
          className="text-sm tracking-[0.2em] uppercase"
          initial={{ y: -20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Ready when you are
        </motion.span>

        <motion.h2
          className="mt-4 max-w-3xl font-heading text-3xl leading-tight tracking-tight md:text-5xl"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Find the journey that fits your pace
        </motion.h2>

        <motion.p
          className="mt-4 max-w-md text-sm opacity-85 md:text-base"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Limestone bays, misty terraces, imperial cities, and river markets — pick a region and let
          a local plan the rest.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          <a
            href="#tours"
            className="group flex cursor-pointer items-center gap-2 rounded-full bg-card px-7 py-3 text-sm font-medium text-card-foreground transition hover:bg-card/85"
          >
            <span>Browse tours</span>
            <MoveRightIcon
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </a>
          <a
            href="#contact"
            className="group cursor-pointer rounded-full border border-on-media/40 px-6 py-3 text-sm font-medium transition hover:border-on-media/70"
          >
            {/* Hiệu ứng chữ trượt dọc khi hover — đồng bộ với nút phụ của hero */}
            <span className="relative block overflow-hidden">
              <span className="block transition-transform duration-200 group-hover:-translate-y-full">
                Talk to a local
              </span>
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 block translate-y-full transition-transform duration-200 group-hover:translate-y-0"
              >
                Talk to a local
              </span>
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
