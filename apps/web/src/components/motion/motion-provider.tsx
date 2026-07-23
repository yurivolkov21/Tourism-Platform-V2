'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

// Bọc MỘT lần ở root layout — mọi animation motion con tự tôn trọng
// prefers-reduced-motion của người dùng.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
