'use client';

import { motion, useScroll, useSpring } from 'motion/react';

// Thanh tiến độ đọc cho tài liệu dài. Đây là THÔNG TIN chứ không phải trang
// trí: terms có 18 mục, người đọc cần biết còn bao xa. Bám mép trên viewport,
// dưới navbar pill. useSpring làm mượt để thanh không giật theo từng nấc cuộn
// của Lenis.
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      // z phải VƯỢT TopBar (z-1700) — để z-50 thì thanh nằm dưới dải marquee.
      // Màu on-media chứ KHÔNG phải primary: TopBar vốn đã là nền jade, thanh
      // jade trên nền jade thì tàng hình (đã đo bằng ảnh).
      className="fixed inset-x-0 top-0 z-[1800] h-0.5 origin-left bg-on-media"
    />
  );
}
