'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// Đếm số khi cuộn tới (một lần). Reduced-motion → hiện thẳng giá trị cuối.
export function AnimatedCounter({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!inView || !el) {
      return;
    }
    const format = (v: number) =>
      `${prefix}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;
    if (reduced) {
      el.textContent = format(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduced, to, decimals, prefix, suffix]);

  // Screen reader đọc giá trị cuối (sr-only); span animation ẩn khỏi cây a11y.
  const finalText = `${prefix}${to.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
  return (
    <>
      <span className="sr-only">{finalText}</span>
      <span ref={ref} className={className} aria-hidden="true">
        {`${prefix}0${suffix}`}
      </span>
    </>
  );
}
