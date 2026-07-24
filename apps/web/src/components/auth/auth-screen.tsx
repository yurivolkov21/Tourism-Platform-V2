'use client';

import { motion } from 'motion/react';
import { Logo } from '@/components/logo';
import { DawnPoster } from './dawn-poster';

// Màn hình auth dùng chung (spec 2026-07-24, redesign vòng 2 sau khảo sát
// Airbnb/Resend/Clerk/Linear): TRÁI vùng form yên tĩnh — chỉ một quầng sáng
// lan từ phía poster sang (bài học Linear: quanh form càng tĩnh càng sang,
// vân đồng mức vòng 1 bị chê "nhìn không rõ hình gì" đã bỏ) · PHẢI tấm poster
// "SAPA EXPRESS" đóng khung hairline + caption mono cùng họ chữ cuống vé.
// Mobile: ẩn panel phải. 6 trang auth chỉ khác ruột form + quote + cuống vé.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

interface AuthScreenProps {
  /** Câu quote đặt trong poster — đổi theo ngữ cảnh từng trang */
  quote: string;
  author: string;
  children: React.ReactNode;
}

export function AuthScreen({ quote, author, children }: AuthScreenProps) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Trái: logo + card, nền chỉ có ánh rạng đông hắt từ poster sang */}
      <div className="relative flex flex-col overflow-hidden px-6 py-8 md:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(52rem_36rem_at_112%_20%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_68%),radial-gradient(38rem_28rem_at_-8%_96%,color-mix(in_oklab,var(--region-spark)_7%,transparent),transparent_70%)]"
        />
        <a href="/" aria-label="tourism — home" className="relative z-10 w-fit select-none">
          <Logo />
        </a>
        <div className="relative z-10 flex flex-1 items-center justify-center py-10">
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

      {/* Phải: poster "SAPA EXPRESS" — chỉ lg+ */}
      <div className="dark relative hidden overflow-hidden bg-background lg:block">
        <DawnPoster />

        {/* Khung poster hairline + caption đầu khung, cùng font mono với cuống vé */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-5 rounded-sm border border-on-media/25"
        />
        <p className="absolute inset-x-0 top-10 text-center font-mono text-[11px] tracking-[0.32em] text-on-media/85 uppercase">
          Sapa Express · departs at dawn
        </p>

        <motion.figure
          className="absolute right-14 bottom-14 left-14 z-10 text-on-media"
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
