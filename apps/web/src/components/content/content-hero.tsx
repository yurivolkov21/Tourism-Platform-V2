'use client';

import { ArrowLeftIcon, ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
  action,
  back,
}: {
  breadcrumb: string;
  title: string;
  /** Dòng "Last updated: …" — trang FAQ không có. */
  meta?: string;
  subtitle?: string;
  /** Control của trang (nút/link) đứng góc phải ngang hàng breadcrumb —
   *  thêm 11/08 cho nút Settings khu account; trang không truyền thì bố cục
   *  y nguyên như cũ. */
  action?: ReactNode;
  /**
   * Nút tròn quay lại, đứng TRƯỚC breadcrumb (spec P7 §4.1). Chỉ có icon, nên `label` vừa là
   * tên đọc-màn-hình vừa là tooltip. Không truyền thì DOM y như trước — các trang đang dùng
   * hero không đổi một nút nào.
   */
  back?: { href: string; label: string };
}) {
  // Breadcrumb dựng MỘT lần, đặt vào một trong hai chỗ: có `back` thì cùng nút vào một hàng
  // con, không có thì đứng thẳng trong hàng như trước.
  const breadcrumbNav = (
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
  );

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
          <div className="flex items-center justify-between gap-4">
            {back ? (
              // Cách breadcrumb 12px như bản vẽ `booking-list.src.html` (`.x-crumbrow`).
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  initial={{ y: -16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, ...SPRING }}
                >
                  {/* Viền và nền là `foreground` mờ: trong scope `dark` của hero nó là chữ
                      sáng, nên ra đúng "viền trắng mờ trên nền tối" mà vẫn tokens-only. */}
                  <Link
                    href={back.href}
                    aria-label={back.label}
                    title={back.label}
                    className="grid size-8.5 place-items-center rounded-full border border-foreground/30 bg-foreground/5 text-foreground transition-colors outline-none hover:bg-foreground/15 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ArrowLeftIcon aria-hidden="true" className="size-4" />
                  </Link>
                </motion.div>
                {breadcrumbNav}
              </div>
            ) : (
              breadcrumbNav
            )}
            {action ? (
              <motion.div
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, ...SPRING }}
              >
                {action}
              </motion.div>
            ) : null}
          </div>

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
