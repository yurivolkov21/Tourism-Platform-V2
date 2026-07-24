'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { Logo } from '@/components/logo';

// Màn hình auth dùng chung (spec 2026-07-24, redesign vòng 3 — user chốt chất
// liệu ẢNH THẬT sau khi 2 vòng đồ hoạ vẽ tay đều lộ "mùi AI"): TRÁI vùng form
// yên tĩnh, chỉ một quầng sáng lan từ phía ảnh sang (bài học Linear/Clerk) ·
// PHẢI ảnh thật Sa Pa + scrim + khung hairline + caption mono cùng họ chữ
// cuống vé + quote đổi theo trang. Mobile: ẩn panel phải.
// Ảnh: "Ray over terrace rice field in Sapa - Trung Chải" — Phi Phi Hoang,
// CC BY 2.0, Wikimedia Commons (crop dọc 4:5, nén q80). Ghi công đặt ngay
// trong UI (dòng credit góc khung) để đúng điều kiện CC BY.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

interface AuthScreenProps {
  /** Câu quote trên panel ảnh — đổi theo ngữ cảnh từng trang */
  quote: string;
  author: string;
  children: React.ReactNode;
}

export function AuthScreen({ quote, author, children }: AuthScreenProps) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Trái: logo + card trên FROSTED GLASS — cùng tấm ảnh Sa Pa của panel
          phải nhưng blur mạnh + voan màu nền, như nhìn thung lũng qua lớp kính
          mờ hơi nước: cả trang là MỘT tác phẩm liền mạch (bài học Resend),
          card solid tự nổi bật. Ảnh trùng src với panel phải → không tốn thêm
          request. Voan chỉnh riêng từng theme để giữ tương phản cho form. */}
      <div className="relative flex flex-col overflow-hidden px-6 py-8 md:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Image
            src="/images/auth-sapa-dawn.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="scale-110 object-cover blur-3xl saturate-[0.9]"
          />
          <div className="absolute inset-0 bg-background/78 dark:bg-background/82" />
          {/* Vignette nhẹ quanh mép để tia sáng gold/jade chỉ "thở" ở rìa */}
          <div className="absolute inset-0 [background:radial-gradient(120%_90%_at_50%_45%,var(--background)_0%,transparent_55%)] opacity-60" />
        </div>
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

      {/* Phải: ảnh thật Sa Pa — chỉ lg+ */}
      <div className="dark relative hidden overflow-hidden bg-background lg:block">
        <Image
          src="/images/auth-sapa-dawn.jpg"
          alt="Sunbeams breaking through clouds over rice terraces near Sa Pa"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover"
        />
        {/* Scrim 2 đầu: đậm dưới chân cho quote, nhẹ mép trên cho caption */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-overlay/90 via-overlay/15 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-overlay/60 to-transparent"
        />

        {/* Khung hairline + caption mono — cùng họ ephemera với cuống vé */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-5 rounded-sm border border-on-media/30"
        />
        <p className="absolute inset-x-0 top-10 text-center font-mono text-[11px] tracking-[0.32em] text-on-media/90 uppercase">
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

        {/* Ghi công CC BY 2.0 — kín đáo kiểu tạp chí, góc phải dưới trong khung */}
        <p className="absolute right-8 bottom-7 font-mono text-[9px] tracking-wide text-on-media/50">
          Photo: Phi Phi Hoang · CC BY 2.0
        </p>
      </div>
    </div>
  );
}
