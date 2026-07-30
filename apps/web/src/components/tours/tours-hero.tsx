'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { TopoPattern } from '@/components/topo-pattern';
import { SPRING, SPRING_HEADING } from '@/lib/motion';

// Hero riêng cho listing tour. KHÔNG tái dùng ContentHero: cái đó phục vụ trang
// nội dung dài (breadcrumb + title + meta + subtitle) và nhồi thêm ô search vào
// là biến nó thành phễu prop. Chung TopoPattern + scrim + nhịp spring là đủ để
// hai trang cảm thấy cùng một sản phẩm.
//
// Band phải TỐI — hero sáng làm navbar trong suốt bị tàng hình (pattern chốt ở
// /contact và giữ nguyên cho mọi trang từ đó).

export function ToursHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  /** Dòng đếm đặt TRÊN H1 — "16 tours across 9 destinations". */
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Ô tìm kiếm; nhận qua children vì nó là client state của ToursExplorer. */
  children?: ReactNode;
}) {
  return (
    <section className="relative w-full overflow-hidden bg-hero px-4 pt-36 pb-14 text-hero-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* Gia vị topo — bản TĨNH, đúng 1 vị trí trên trang (bản động canvas đã bị
          loại 25/07 vì chạy liên tục làm phá nhịp tĩnh). */}
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
              Tours
            </span>
          </motion.nav>

          {/* Số kết quả đặt TRÊN H1 dạng câu chữ (mẫu GetYourGuide "500+ results:",
            G Adventures "1126 tours found") — không phải label khô nhét cạnh
            dropdown sort. */}
          <motion.p
            className="mt-8 font-mono text-xs tracking-widest text-muted-foreground uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, ...SPRING }}
          >
            {eyebrow}
          </motion.p>

          <motion.h1
            className="mt-3 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING_HEADING, delay: 0.2 }}
          >
            {title}
          </motion.h1>

          <motion.p
            className="mt-4 max-w-2xl text-pretty text-muted-foreground"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, ...SPRING }}
          >
            {subtitle}
          </motion.p>

          {children ? (
            <motion.div
              className="mt-8 max-w-md"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, ...SPRING }}
            >
              {children}
            </motion.div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
