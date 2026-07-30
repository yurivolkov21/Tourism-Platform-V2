'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TopoPattern } from '@/components/topo-pattern';
import { SPRING, SPRING_HEADING } from '@/lib/motion';

// Header dùng chung cho trang nội dung dài (terms/privacy/cancellation/faq).
// Band NGẮN và TỐI: khác Nexora ContentHero (ảnh full-bleed) — theo khảo sát
// Vercel/Linear/Stripe, trang pháp lý mở bằng typography chứ không bằng ảnh.
// Vẫn phải scope `dark` vì navbar chưa cuộn dùng chữ on-media; hero sáng làm
// navbar tàng hình (pattern "hero luôn tối" chốt ở /contact).

export function ContentHero({
  breadcrumb,
  title,
  meta,
  subtitle,
}: {
  breadcrumb: string;
  title: string;
  /** Dòng "Last updated: …" — trang FAQ không có. */
  meta?: string;
  subtitle?: string;
}) {
  return (
    <section className="relative w-full overflow-hidden bg-hero px-4 pt-36 pb-14 text-hero-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* Gia vị topo — đúng 1 vị trí trên trang này. Cố ý dùng bản TĨNH: bản
          động (canvas) từng thử ngày 25/07 bị loại vì vân dày lên và chạy liên
          tục, phá mất nhịp tĩnh của trang đọc. */}
      {/* Ra ngoài scope dark để biến thể `dark:` đọc theme của TRANG:
          nền hero tối hơn ở dark mode nên vân phải đậm lên mới đọc được. */}
      <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />

      {/* `dark` chuyển từ <section> vào ĐÂY. Trước kia nó nằm trên section nên
          `bg-background` bị đọc trong scope dark → ở dark mode hero trùng màu
          tuyệt đối với nền trang và biến mất. Nay section đọc `bg-hero` theo
          theme CỦA TRANG, còn scope dark chỉ bọc nội dung để chữ luôn sáng.
          `contents` để wrapper không tạo hộp, bố cục bên trong không đổi —
          biến CSS vẫn kế thừa qua display:contents. */}
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
              {breadcrumb}
            </span>
          </motion.nav>

          <motion.h1
            className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING_HEADING, delay: 0.2 }}
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
      </div>
    </section>
  );
}
