'use client';

import { MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Review #23: convert 100% lối thiết kế forged/CTABanner (quyết định của user —
// trước đó #21 mới lấy xương, lần này lấy cả chất giọng): eyebrow màu accent,
// heading 2 dòng ALL-CAPS đậm với dòng sau nhuộm primary + dấu chấm, mô tả mờ,
// nút chính màu accent glow khi hover + scale, nút phụ outline mảnh. Chỉ thay
// da thịt bằng token + font dự án (Literata heading, không hex, không neon).
// Toàn bộ nội dung nằm trong scope `dark` — banner luôn tối ở cả hai theme.
export function CallToAction() {
  return (
    <section className="relative w-full overflow-hidden py-32">
      {/* Nền banner: placeholder + scrim + vệt gradient nhấn primary (forged: neon/10) */}
      <div className="dark absolute inset-0 -z-10">
        <ImagePlaceholder corner label="Banner — Mekong delta at dusk" className="h-full w-full" />
        <div className="absolute inset-0 bg-overlay" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
        />
      </div>

      <div className="dark mx-auto flex max-w-5xl flex-col items-center px-4 text-center text-foreground">
        <motion.span
          className="mb-6 block text-xs font-semibold tracking-[0.25em] text-primary uppercase"
          initial={{ y: -20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Autumn departures open
        </motion.span>

        {/* Review #25: bỏ ALL-CAPS + weight 900 (Literata viết hoa toàn bộ ra chất
            "khắc bia đá" quá cứng) — giữ kịch bản 2 dòng + dòng accent + dấu chấm
            của forged nhưng typography về giọng brand: sentence case, weight vừa,
            dòng accent nghiêng italic cho mềm. */}
        <motion.h2
          className="mx-auto mb-8 max-w-4xl font-heading text-4xl leading-tight font-medium tracking-tight md:text-6xl"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Find the journey
          <br />
          <span className="text-primary italic">that fits your pace.</span>
        </motion.h2>

        <motion.p
          className="mx-auto mb-10 max-w-md text-base text-foreground/50"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Limestone bays, misty terraces, imperial cities, and river markets — pick a region and let
          a local plan the rest. Small groups, no rush, no scripts.
        </motion.p>

        <motion.div
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          {/* Glow hover của forged: bóng đổ lấy màu từ token primary qua color-mix */}
          <motion.a
            href="#tours"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-shadow duration-300 hover:shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          >
            <span>Browse tours</span>
            <MoveRightIcon
              className="size-4.5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </motion.a>
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-7 py-3 text-sm font-medium transition-colors duration-200 hover:border-foreground/50"
          >
            Talk to a local
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
