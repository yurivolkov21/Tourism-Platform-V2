'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { SPRING } from '@/lib/motion';

/** Cặp token của từng tone.
 *
 *  · `default` giữ NGUYÊN VĂN chuỗi class cũ — 21 component đang dùng eyebrow
 *    này, không chỗ nào được đổi một ký tự.
 *  · `onMedia` là cặp token CỐ ĐỊNH (không lật theo theme), dành cho nền tối ở
 *    CẢ HAI theme — băng cuối `/destinations/[region]`, ảnh phủ scrim. Đặt cặp
 *    `foreground` theo-theme lên nền đó là
 *    chữ tối-trên-tối ở light mode — đúng lớp lỗi cụm destinations đã dính
 *    nhiều lần khi pha token cố định với token theo-theme.
 */
const TONES = {
  default: {
    dot: 'size-1.5 bg-foreground',
    text: 'text-sm tracking-wide text-foreground uppercase',
  },
  onMedia: {
    dot: 'size-1.5 bg-on-media',
    text: 'text-sm tracking-wide text-on-media uppercase',
  },
} as const;

// Eyebrow kiểu Estate: chấm vuông nhỏ + chữ, trồi nhẹ từ trên xuống.
export function SectionEyebrow({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  const palette = TONES[tone];

  return (
    <motion.div
      className="flex items-center gap-1.5"
      initial={{ y: -20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ ...SPRING, delay: 0.2 }}
    >
      <span className={palette.dot} aria-hidden="true" />
      <span className={palette.text}>{children}</span>
    </motion.div>
  );
}
