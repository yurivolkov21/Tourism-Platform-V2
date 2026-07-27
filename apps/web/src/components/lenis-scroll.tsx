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

    // Dừng Lenis khi có modal mở. Base UI khoá cuộn nền bằng
    // `body { overflow: hidden }`, NHƯNG vùng cuộn thật của trang là <html>
    // (overflow vẫn `visible`) nên Lenis cuộn tiếp bất chấp — đo được 27/07:
    // mở drawer lọc /tours rồi lăn chuột trên lớp phủ, window.scrollY nhảy
    // 700px trong khi lẽ ra phải đứng im.
    //
    // Theo dõi chính tín hiệu Base UI đã phát ra, nên cách này đúng cho MỌI
    // modal của app (dialog · sheet · drawer · alert-dialog), không riêng một
    // chỗ. Bổ sung cho `data-lenis-prevent` — thuộc tính đó trả wheel lại cho
    // vùng cuộn BÊN TRONG modal, còn cái này chặn nền cuộn khi con trỏ ở NGOÀI.
    const syncLock = () => {
      if (getComputedStyle(document.body).overflow === 'hidden') lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    syncLock();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
