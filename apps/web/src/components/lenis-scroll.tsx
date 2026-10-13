'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { setLenis } from '@/lib/smooth-scroll';

// Convert từ template Estate: smooth scroll toàn trang bằng Lenis.
// Tôn trọng prefers-reduced-motion — người dùng giảm chuyển động thì không bật.
export function LenisScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  // Điều hướng bằng `router.push` (nút Reserve của khối ảnh, đăng nhập xong, đăng xuất…) không có
  // cú bấm link nào để `stopInertiaOnNavigate` bắt, nên trong ~1,2 giây sau cú lăn chuột Lenis vẫn
  // kéo trang mới về đích cũ (open-items G33, phần còn lại sau `f79df8c8`). Buông quán tính ngay khi
  // pathname đổi: layout effect chạy trong cùng lượt commit của trang mới, TRƯỚC khung hình kế
  // tiếp nơi Lenis sẽ ghi vị trí cũ. `LenisScroll` nằm ở root layout nên sống qua mọi điều hướng.
  // `reset()` của Lenis 1.3.25 là private; `stop()` rồi `start()` là đường công khai, cả hai đều gọi
  // nó. Lenis đang dừng vì có modal mở thì chẳng còn quán tính nào để buông, mà `start()` lúc ấy lại
  // mở khoá cuộn nền dưới modal, nên bỏ qua.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy lại theo pathname là chủ đích, thân hàm không đọc nó
  useLayoutEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis || lenis.isStopped) return;
    lenis.stop();
    lenis.start();
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      syncTouch: false,
      anchors: true,
      // Đo giới hạn cuộn TẠI CHỖ mỗi lần cần (`scrollHeight − clientHeight` của <html>) thay vì nhớ
      // số đo cũ. Lenis chỉ đo lại khi cửa sổ đổi cỡ hoặc khi ResizeObserver trên <html> báo, mà
      // <html> mang `h-full` (layout.tsx) nên hộp của nó luôn cao bằng khung nhìn: trang dài ra
      // (điều hướng mềm, đổi tab) thì Lenis vẫn tin đáy cũ và kẹp lăn chuột ở đó. Đo 09/10 trên
      // next build: tải cứng trang chi tiết đơn (đáy 1378) rồi bấm "Full itinerary" → trang tour
      // (tab Itinerary, đáy thật 2812) lăn chuột dừng ở 1378; tải cứng trang tour rồi bấm tab
      // Itinerary (cao hơn Overview) thì dừng ở 2100, đáy của Overview.
      naiveDimensions: true,
      // Bấm link sang trang khác (cùng host, khác pathname) thì Lenis buông quán tính của cú lăn
      // chuột vừa rồi. Không có nó, trong ~1,2 giây (`duration`) sau cú lăn Lenis còn ghi vị trí mỗi
      // khung hình và kéo trang mới về đích cũ: "Full itinerary" dừng ở 1080 thay vì mốc 1167, link
      // không hash dừng ở 120 thay vì đầu trang (open-items G33, đo lại 09/10). Link cùng trang có
      // hash vẫn do `anchors` lo như trước.
      stopInertiaOnNavigate: true,
    });

    // Đăng ký để mọi cuộn lập trình (phân trang, nút lên đầu) đi QUA Lenis —
    // không thì chúng tranh vô-lăng với quán tính con lăn và thua (đo 19/08,
    // xem `lib/smooth-scroll.ts`).
    setLenis(lenis);
    lenisRef.current = lenis;

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
      setLenis(null);
      lenisRef.current = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
