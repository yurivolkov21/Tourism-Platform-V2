'use client';

import { ArrowUpRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SPRING } from '@/lib/motion';

// Contact §5 — CTA 01 "Gradient Banner" (ShadcnSpace) HỒI SINH từ about-cta
// đã dọn ở 5e9dd08: user chốt dùng cho /contact để tránh trùng CTA 02 video
// của /about. Card bo 3xl viền nổi, nền "aurora" token hóa (jade primary +
// vàng nắng --region-spark), nút MORPH viên tròn mũi tên trượt phải→trái +
// xoay 45° khi hover.

export function ContactCta() {
  return (
    <section className="w-full px-4 py-8 sm:py-20 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="relative flex min-h-96 items-center justify-center overflow-hidden rounded-3xl border px-6 before:absolute before:top-24 before:-z-10 before:h-4/5 before:w-full before:rounded-full before:bg-linear-to-r before:from-primary/25 before:from-15% before:via-background before:via-55% before:to-[var(--region-spark)]/30 before:to-90% before:blur-3xl">
          <motion.div
            className="mx-auto flex flex-col items-center gap-6"
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="font-heading text-3xl font-medium text-foreground md:text-5xl">
                The road is ready
                <span className="text-primary italic"> when you are.</span>
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Twelve seats, three regions, and people who grew up on every path. Pick a journey
                and let the country set the pace.
              </p>
            </div>

            {/* Nút morph: viên tròn mũi tên trượt phải→trái + xoay 45° khi hover */}
            <a
              href="/#tours"
              className="group relative h-12 w-fit cursor-pointer overflow-hidden rounded-full bg-primary p-1 ps-6 pe-14 text-sm font-medium text-primary-foreground transition-all duration-500 hover:bg-primary/80 hover:ps-14 hover:pe-6"
            >
              <span className="relative z-10 inline-flex h-full items-center transition-all duration-500">
                Browse the tours
              </span>
              <span className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-full bg-background text-foreground transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45">
                <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
