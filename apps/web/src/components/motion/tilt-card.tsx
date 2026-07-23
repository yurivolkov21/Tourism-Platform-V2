'use client';

import { useReducedMotion } from 'motion/react';
import { type ReactNode, useRef } from 'react';

// Convert từ PrebuiltUI "On Hover Tilt Effect Card" (review #14): card nghiêng
// 3D theo vị trí con trỏ (rotateX/Y quanh tâm), rời chuột thì về phẳng.
// Reduced-motion → đứng yên hoàn toàn.
const MAX_TILT_DEG = 8;

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced) {
      return;
    }
    const rect = el.getBoundingClientRect();
    // Vị trí con trỏ so với tâm card, chuẩn hóa [-1, 1]
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${px * MAX_TILT_DEG * 2}deg) rotateX(${-py * MAX_TILT_DEG * 2}deg) scale(1.02)`;
  };

  const handleLeave = () => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: handler chỉ trang trí (tilt theo con trỏ) — phần tương tác thật là <a> con; bàn phím/screen reader không phụ thuộc
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      role="presentation"
      className={`transition-transform duration-200 ease-out will-change-transform ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
