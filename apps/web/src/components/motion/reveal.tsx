'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

// Bọc reveal khi cuộn tới — dùng đúng nhịp spring của cả site (320/70/1) để
// trang nội dung dài không lệch tông với Home/About/Contact. `motion` tự tôn
// trọng prefers-reduced-motion qua MotionProvider ở root layout.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: 24, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}
