'use client';

import { MotionConfig, motion } from 'motion/react';
import type { ReactNode } from 'react';

// Bọc MỘT lần ở page.tsx — mọi animation con tự tôn trọng prefers-reduced-motion.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Trễ (giây) — dùng cho stagger thủ công giữa các card. */
  delay?: number;
  /** Khoảng trồi lên (px). */
  y?: number;
}

// Island reveal dùng chung: hiện dần + trồi lên khi cuộn tới, chỉ chạy một lần.
export function Reveal({ children, className, delay = 0, y = 28 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 260, damping: 60, delay }}
    >
      {children}
    </motion.div>
  );
}
