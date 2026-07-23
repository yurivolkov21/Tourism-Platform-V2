'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

// Eyebrow kiểu Estate: chấm vuông nhỏ + chữ, trồi nhẹ từ trên xuống.
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex items-center gap-1.5"
      initial={{ y: -20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
    >
      <span className="size-1.5 bg-foreground" aria-hidden="true" />
      <span className="text-sm tracking-wide text-foreground uppercase">{children}</span>
    </motion.div>
  );
}
