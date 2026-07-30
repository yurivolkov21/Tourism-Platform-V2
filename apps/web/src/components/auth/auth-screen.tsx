'use client';

import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { Logo } from '@/components/logo';
import { SPRING } from '@/lib/motion';

// Màn hình auth dùng chung (spec 2026-07-24, redesign vòng 3 — user chốt chất
// liệu ẢNH THẬT sau khi 2 vòng đồ hoạ vẽ tay đều lộ "mùi AI"): TRÁI vùng form
// yên tĩnh, chỉ một quầng sáng lan từ phía ảnh sang (bài học Linear/Clerk) ·
// PHẢI ảnh Sa Pa + scrim + khung hairline + caption mono cùng họ chữ cuống vé
// + quote đổi theo trang. Mobile: ẩn panel phải.
// Task 3c mục 0: toàn site tạm về ImagePlaceholder (user chốt lại — chưa dùng
// ảnh thật ở bất kỳ trang nào). Ảnh thật "Ray over terrace rice field in Sapa
// - Trung Chải" (Phi Phi Hoang, CC BY 2.0, Wikimedia Commons) vẫn nằm sẵn ở
// public/images/auth-sapa-dawn.jpg chờ lúc chốt trang; dòng ghi công CC BY bỏ
// tạm khỏi UI vì ghi công cho ảnh không hiển thị là sai — thêm lại cùng lúc
// với ảnh thật.

interface AuthScreenProps {
  /** Câu quote trên panel ảnh — đổi theo ngữ cảnh từng trang */
  quote: string;
  author: string;
  children: React.ReactNode;
}

export function AuthScreen({ quote, author, children }: AuthScreenProps) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Trái: logo + card trên BẢN ĐỒ TRẮC ĐỊA (vòng chỉnh theo khảo sát
          Dribbble/AllTrails): vân đồng mức SINH BẰNG THUẬT TOÁN (value-noise +
          marching squares, script scratchpad gen-topo.mjs seed 7) phủ kín nền
          như bản đồ thật — kèm lưới toạ độ + dấu × trắc địa nằm sẵn trong
          /images/auth-topo.svg, dùng làm CSS MASK nên màu tô là token và tự
          ăn theo theme. Đè lên là TUYẾN HÀNH TRÌNH chấm chấm + nhãn cao độ
          mono: 1 650 m (ga Sa Pa, điểm khởi hành) → 3 143 m (đỉnh Fansipan,
          điểm đến) — đồng bộ vé HN → SAPA và câu "where the map left off". */}
      <div className="relative flex flex-col overflow-hidden px-6 py-8 md:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-primary opacity-[0.14] dark:opacity-[0.22] [mask-image:url(/images/auth-topo.svg)] [mask-position:center] [mask-size:cover]"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 900 1000"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full"
          fill="none"
        >
          {/* Tuyến hành trình: chấm chấm thung lũng → đỉnh + trạm dừng */}
          <g className="opacity-35 dark:opacity-45">
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
        {/* Nhãn cao độ kiểu bản đồ — cạnh điểm đi/điểm đến của tuyến */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[17%] left-[15%] font-mono text-[10px] tracking-[0.15em] text-muted-foreground/60"
        >
          1 650 M
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-[12.5%] right-[16%] font-mono text-[10px] tracking-[0.15em] text-muted-foreground/60"
        >
          FAN SI PAN · 3 143 M
        </span>
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

      {/* Phải: ảnh Sa Pa (placeholder tạm) — chỉ lg+ */}
      <div className="dark relative hidden overflow-hidden bg-background lg:block">
        <ImagePlaceholder
          label="Sa Pa terraces at dawn"
          className="absolute inset-0 h-full w-full"
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

        {/* Ghi công CC BY 2.0 tạm bỏ khỏi UI — ảnh đang là placeholder (task 3c
            mục 0), ghi công cho ảnh không hiển thị là sai; thêm lại cùng lúc
            với ảnh thật auth-sapa-dawn.jpg. */}
      </div>
    </div>
  );
}
