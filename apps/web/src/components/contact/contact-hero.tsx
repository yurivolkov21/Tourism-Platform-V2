'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';

// Contact §1 — hero NGẮN kiểu Nexora ContentHero (trang utility không cần
// fullscreen): breadcrumb + heading 2 dòng accent italic + sub 1 dòng.
// Nền scope `dark` BẮT BUỘC: navbar chưa-cuộn dùng chữ on-media (trắng) theo
// pattern "hero luôn tối" của site — hero sáng sẽ làm navbar tàng hình.
// Thêm vệt gradient primary cho band đỡ phẳng.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function ContactHero() {
  return (
    <section className="dark relative w-full overflow-hidden bg-background px-4 pt-36 pb-16 text-foreground md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <a href="/" className="transition-colors hover:text-foreground">
            Home
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            Contact
          </span>
        </motion.nav>

        <motion.h1
          className="mt-6 font-heading text-4xl leading-tight font-medium text-foreground md:text-6xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Talk to a human,
          <br />
          <span className="text-primary italic">not a hotline.</span>
        </motion.h1>

        <motion.p
          className="mt-4 max-w-md text-sm text-muted-foreground md:text-base"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, ...SPRING }}
        >
          Tell us your dates and pace — a real person replies within the hour, Monday to Friday.
        </motion.p>
      </div>
    </section>
  );
}
