'use client';

import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  className?: string;
  separator?: string;
}

// Convert từ template Estate (components/count-number.tsx) sang chuẩn dự án:
// import motion/react, spring đếm số khi vào viewport, chạy một lần.
export function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 2,
  className = '',
  separator = ',',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);
  // Damping/stiffness dẫn xuất từ duration như template gốc.
  const springValue = useSpring(motionValue, {
    damping: 20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  });
  const inView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = String(from);
    }
  }, [from]);

  useEffect(() => {
    if (!inView) {
      return;
    }
    const timer = setTimeout(() => motionValue.set(to), delay * 1000);
    return () => clearTimeout(timer);
  }, [inView, delay, motionValue, to]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        const formatted = Intl.NumberFormat('en-US', {
          useGrouping: !!separator,
          maximumFractionDigits: 0,
        }).format(Math.round(latest));
        ref.current.textContent = separator ? formatted.replace(/,/g, separator) : formatted;
      }
    });
  }, [springValue, separator]);

  return <span ref={ref} className={className} />;
}
