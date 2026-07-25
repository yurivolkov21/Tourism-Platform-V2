'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TopoLive } from '@/components/topo-live';

// Header dùng chung cho trang nội dung dài (terms/privacy/cancellation/faq).
// Band NGẮN và TỐI: khác Nexora ContentHero (ảnh full-bleed) — theo khảo sát
// Vercel/Linear/Stripe, trang pháp lý mở bằng typography chứ không bằng ảnh.
// Vẫn phải scope `dark` vì navbar chưa cuộn dùng chữ on-media; hero sáng làm
// navbar tàng hình (pattern "hero luôn tối" chốt ở /contact).
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function ContentHero({
  breadcrumb,
  title,
  meta,
  subtitle,
  seed = 11,
}: {
  breadcrumb: string;
  title: string;
  /** Dòng "Last updated: …" — trang FAQ không có. */
  meta?: string;
  subtitle?: string;
  /** Đổi vân giữa các trang trong cụm để không trang nào giống trang nào. */
  seed?: number;
}) {
  return (
    <section className="dark relative w-full overflow-hidden bg-background px-4 pt-36 pb-14 text-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* Gia vị topo — đúng 1 vị trí trên trang này, bản ĐỘNG trôi rất chậm */}
      <TopoLive variant="ambient" seed={seed} className="text-primary opacity-30" />

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
            {breadcrumb}
          </span>
        </motion.nav>

        <motion.h1
          className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          {title}
        </motion.h1>

        {meta ? (
          <motion.p
            className="mt-5 font-mono text-xs tracking-widest text-muted-foreground uppercase"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            {meta}
          </motion.p>
        ) : null}

        {subtitle ? (
          <motion.p
            className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}
