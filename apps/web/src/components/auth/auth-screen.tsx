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
      {/* Trái: logo + card trên BẢN ĐỒ ĐỒNG MỨC (user chọn lại hướng vân vòng 1,
          thực thi đậm chất bản đồ hơn): 2 cụm vân 6 vòng — ĐỈNH trên-phải,
          THUNG LŨNG dưới-trái, tâm vòng trôi dần như topo thật — nối bằng
          TUYẾN HÀNH TRÌNH chấm chấm thung lũng → đỉnh (đồng bộ vé HN → SAPA
          và câu "where the map left off"), trạm dừng chấm hổ phách. Card đặc
          che khúc giữa tuyến nên nét có thể chạy tự do sau lưng nó. */}
      <div className="relative flex flex-col overflow-hidden px-6 py-8 md:px-12">
        <svg
          aria-hidden="true"
          viewBox="0 0 900 1000"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full"
          fill="none"
        >
          {/* Cụm vân: đỉnh (trên-phải) + thung lũng (dưới-trái) */}
          <g className="stroke-primary opacity-[0.11] dark:opacity-[0.17]" strokeWidth="1.25">
            <path d="M758 145 C758 173 732 195 700 195 C675 195 654 173 654 145 C654 120 675 100 700 100 C732 100 758 120 758 145 Z" />
            <path d="M807 153 C807 207 758 251 697 251 C648 251 609 207 609 153 C609 102 648 61 697 61 C758 61 807 102 807 153 Z" />
            <path d="M866 163 C866 246 789 313 694 313 C617 313 554 246 554 163 C554 81 617 15 694 15 C789 15 866 81 866 163 Z" />
            <path d="M928 175 C928 289 821 381 690 381 C582 381 494 289 494 175 C494 60 582 -33 690 -33 C821 -33 928 60 928 175 Z" />
            <path d="M992 190 C992 338 855 458 686 458 C544 458 428 338 428 190 C428 40 544 -82 686 -82 C855 -82 992 40 992 190 Z" />
            <path d="M1060 207 C1060 391 891 541 682 541 C503 541 358 391 358 207 C358 19 503 -133 682 -133 C891 -133 1060 19 1060 207 Z" />
            <path d="M164 788 C164 812 141 832 112 832 C89 832 70 812 70 788 C70 766 89 748 112 748 C141 748 164 766 164 788 Z" />
            <path d="M218 781 C218 831 173 871 118 871 C73 871 36 831 36 781 C36 735 73 697 118 697 C173 697 218 735 218 781 Z" />
            <path d="M282 773 C282 851 212 915 126 915 C54 915 -4 851 -4 773 C-4 698 54 637 126 637 C212 637 282 698 282 773 Z" />
            <path d="M355 763 C355 873 256 963 135 963 C33 963 -49 873 -49 763 C-49 656 33 569 135 569 C256 569 355 656 355 763 Z" />
            <path d="M435 752 C435 897 305 1014 145 1014 C10 1014 -99 897 -99 752 C-99 610 10 494 145 494 C305 494 435 610 435 752 Z" />
            <path d="M518 740 C518 921 356 1068 156 1068 C-14 1068 -152 921 -152 740 C-152 560 -14 414 156 414 C356 414 518 560 518 740 Z" />
          </g>
          {/* Tuyến hành trình: chấm chấm thung lũng → đỉnh + trạm dừng */}
          <g className="opacity-30 dark:opacity-40">
            <path
              d="M112 786 C220 730 300 640 320 540 C338 452 430 430 520 400 C620 366 660 250 697 150"
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="0.1 11"
            />
            <circle cx="112" cy="786" r="5" className="fill-primary" />
            <circle cx="112" cy="786" r="11" className="stroke-primary" strokeWidth="1.5" />
            <circle cx="320" cy="540" r="4" className="fill-(--region-spark)" />
            <circle cx="520" cy="400" r="4" className="fill-(--region-spark)" />
            <circle cx="697" cy="150" r="5" className="fill-(--region-spark)" />
            <circle
              cx="697"
              cy="150"
              r="11"
              className="stroke-(--region-spark)"
              strokeWidth="1.5"
            />
          </g>
        </svg>
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
