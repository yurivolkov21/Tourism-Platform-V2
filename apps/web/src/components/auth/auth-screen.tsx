'use client';

import { motion } from 'motion/react';
import { Logo } from '@/components/logo';
import { Aurora } from './aurora';

// Màn hình auth dùng chung (spec 2026-07-24, hướng A "khung cửa lên đường"):
// TRÁI vùng form (logo về Home + TicketCard do page truyền vào, nền vân bản đồ
// đồng mức mờ) · PHẢI panel tối "bình minh trên ruộng bậc thang" — KHÔNG dùng
// ảnh: Aurora shader (port React Bits, màu token jade→hổ phách) làm trời rạng,
// 3 lớp SVG silhouette làm ruộng bậc thang, quote Literata italic đổi theo
// trang. Mobile: ẩn panel phải. 6 trang auth chỉ khác ruột form + quote + cuống vé.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

// Ramp màu bình minh trái→phải: jade sẫm → jade brand → hổ phách (spark).
// Hoisted ra module scope để identity ổn định — Aurora dùng làm useEffect dep.
const DAWN_STOPS: [string, string, string] = ['--region-deep', '--primary', '--region-spark'];

interface AuthScreenProps {
  /** Câu quote panel phải — đổi theo ngữ cảnh từng trang */
  quote: string;
  author: string;
  children: React.ReactNode;
}

/** 3 lớp ruộng bậc thang silhouette chân panel — xa→gần: jade nhạt dần về nền tối */
function TerraceRidges() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0">
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 240"
        preserveAspectRatio="none"
        className="block h-40 w-full lg:h-56"
      >
        <path
          d="M0 130 C 180 80, 320 150, 500 110 S 860 40, 1060 95 S 1350 130, 1440 90 L1440 240 L0 240 Z"
          className="fill-primary/25"
        />
        <path
          d="M0 170 C 220 120, 420 185, 640 150 S 980 100, 1180 145 S 1380 175, 1440 150 L1440 240 L0 240 Z"
          className="fill-primary/35"
        />
        <path
          d="M0 205 C 260 165, 480 220, 720 195 S 1080 155, 1300 190 L1440 200 L1440 240 L0 240 Z"
          className="fill-background"
        />
      </svg>
    </div>
  );
}

/** Vân bản đồ đồng mức mờ sau ticket — "lên đường" bắt đầu từ tấm bản đồ */
function ContourLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-[0.06] dark:opacity-[0.09]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      {/* Cụm đỉnh trên-phải */}
      <path d="M560 40 C 640 20, 740 60, 760 140 S 700 280, 600 260 S 480 180, 500 110 S 520 50, 560 40 Z" />
      <path d="M580 80 C 640 65, 700 95, 715 150 S 670 240, 600 225 S 530 170, 545 120 S 545 90, 580 80 Z" />
      <path d="M600 120 C 640 110, 670 130, 678 160 S 650 205, 608 195 S 570 165, 580 140 S 575 127, 600 120 Z" />
      {/* Cụm thung lũng dưới-trái */}
      <path d="M40 620 C 140 570, 280 600, 320 690 S 260 850, 140 840 S -20 760, 10 680 S 0 640, 40 620 Z" />
      <path d="M80 660 C 150 625, 250 650, 275 715 S 230 810, 145 800 S 40 745, 60 690 S 50 675, 80 660 Z" />
      <path d="M120 700 C 165 680, 220 695, 235 735 S 205 790, 155 782 S 95 750, 108 720 S 100 710, 120 700 Z" />
    </svg>
  );
}

export function AuthScreen({ quote, author, children }: AuthScreenProps) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Trái: logo + card trên nền bản đồ đồng mức */}
      <div className="relative flex flex-col overflow-hidden px-6 py-8 md:px-12">
        <ContourLines />
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

      {/* Phải: "khung cửa lên đường" — trời rạng shader + ruộng bậc thang, chỉ lg+ */}
      <div className="dark relative hidden overflow-hidden bg-background lg:block">
        <Aurora
          tokenStops={DAWN_STOPS}
          amplitude={1.1}
          blend={0.55}
          speed={0.55}
          className="absolute inset-0"
        />
        <TerraceRidges />
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
