'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

// Convert từ template Estate: smooth scroll toàn trang bằng Lenis.
// Tôn trọng prefers-reduced-motion — người dùng giảm chuyển động thì không bật.
export function LenisScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      syncTouch: false,
      anchors: true,
    });

    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
