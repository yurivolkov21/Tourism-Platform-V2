'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TopoPattern } from '@/components/topo-pattern';
import { SPRING, SPRING_HEADING } from '@/lib/motion';

// Contact §1 — hero NGẮN kiểu Nexora ContentHero (trang utility không cần
// fullscreen): breadcrumb + heading 2 dòng accent italic + sub 1 dòng.
// Nền scope `dark` BẮT BUỘC: navbar chưa-cuộn dùng chữ on-media (trắng) theo
// pattern "hero luôn tối" của site — hero sáng sẽ làm navbar tàng hình.
// Thêm vệt gradient primary cho band đỡ phẳng.

export function ContactHero() {
  return (
    <section className="relative w-full overflow-hidden bg-hero px-4 pt-36 pb-16 text-hero-foreground md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* Gia vị topo (demo 25/07): bản đồ jade mờ — nối duyên "lá thư từ Sa Pa" */}
      {/* Ra ngoài scope dark để `dark:` đọc theme của TRANG — nền hero tối hơn ở
          dark mode nên vân phải đậm lên mới đọc được. */}
      <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />
      {/* `dark` chuyển TỪ <section> vào đây: để trên section thì `bg-background`
          bị đọc trong scope dark và ở dark mode hero trùng màu nền trang.
          `contents` để wrapper không tạo hộp — biến CSS vẫn kế thừa qua
          display:contents. Xem docs/conventions/color-system.md. */}
      <div className="dark contents">
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
            transition={{ ...SPRING_HEADING, delay: 0.2 }}
          >
            Talk to a human,
            <br />
            <span className="text-primary-emphasis italic">not a hotline.</span>
          </motion.h1>

          <motion.p
            className="mt-4 max-w-md text-sm text-muted-foreground md:text-base"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            Tell us your dates and pace — a real person replies within the hour, Monday to Friday.
          </motion.p>

          {/* Dòng "presence" người thật đang trực (mock — nguồn thật là API/CRM
            sau này): chấm jade thở, motion-safe để tôn trọng reduced-motion */}
          <motion.p
            className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm text-foreground/80"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, ...SPRING }}
          >
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Mai is on replies today — average answer: 47 minutes
          </motion.p>
        </div>
      </div>
    </section>
  );
}
