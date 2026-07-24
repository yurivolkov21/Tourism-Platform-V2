'use client';

import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { Logo } from '@/components/logo';

// Màn hình auth dùng chung (spec 2026-07-24, hướng A "khung cửa lên đường"):
// TRÁI vùng form (logo về Home + TicketCard do page truyền vào) · PHẢI panel
// tối cố định — ảnh placeholder + scrim + quote Literata italic đổi theo trang.
// Mobile: ẩn panel phải. 6 trang auth chỉ khác ruột form + quote + cuống vé.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

interface AuthScreenProps {
  /** Câu quote panel phải — đổi theo ngữ cảnh từng trang */
  quote: string;
  author: string;
  children: React.ReactNode;
}

export function AuthScreen({ quote, author, children }: AuthScreenProps) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Trái: logo + card */}
      <div className="relative flex flex-col px-6 py-8 md:px-12">
        <a href="/" aria-label="tourism — home" className="w-fit select-none">
          <Logo />
        </a>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, ...SPRING }}
          >
            {children}
          </motion.div>
        </div>
      </div>

      {/* Phải: panel tối "khung cửa lên đường" — chỉ lg+ */}
      <div className="dark relative hidden overflow-hidden lg:block">
        <ImagePlaceholder
          corner
          label="Auth panel — dawn over the terraces, Sa Pa"
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-linear-to-t from-overlay via-overlay/40 to-transparent" />
        <motion.figure
          className="absolute right-12 bottom-12 left-12 z-10 text-on-media"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, ...SPRING }}
        >
          <blockquote className="max-w-md font-heading text-2xl leading-snug italic">
            “{quote}”
          </blockquote>
          <figcaption className="mt-3 text-sm opacity-75">— {author}</figcaption>
        </motion.figure>
      </div>
    </div>
  );
}
