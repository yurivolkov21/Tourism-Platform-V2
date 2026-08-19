/**
 * MỘT lối cuộn lập trình cho toàn site — vì trang có Lenis.
 *
 * Bệnh đo được 19/08 trên /tours (thí nghiệm có đối chứng, 5 lần): bấm số
 * trang khi Lenis CÒN quán tính con lăn (bấm ngay / sau 150ms) thì
 * `window.scrollTo({behavior:'smooth'})` KHÔNG ăn — khung hình đứng nguyên;
 * đợi Lenis lắng (~2s) rồi bấm thì chạy đúng. Lý do: Lenis bắt con lăn và
 * tự ghi `scrollY` MỖI FRAME tới khi animation của nó xong; native smooth
 * scroll của trình duyệt là tài xế thứ hai cùng cầm vô-lăng và thua. Đó là
 * "lúc được lúc không" user thấy. `ScrollToTop` dùng `window.scrollTo` cũng
 * mang lỗi ngầm y hệt.
 *
 * Cách đúng: khi Lenis đang cầm lái thì cuộn QUA nó (`lenis.scrollTo`) — nó
 * huỷ quán tính cũ và lái tới đích mới. Không có Lenis (reduced-motion → không
 * khởi tạo, xem `lenis-scroll.tsx`) mới rơi về API gốc. `LenisScroll` đăng
 * ký/huỷ instance qua `setLenis`; module này KHÔNG import 'lenis' để bundle
 * chỗ khác không kéo thư viện theo — chỉ cần một hình dạng tối thiểu.
 */
export interface SmoothScroller {
  scrollTo: (target: number, options?: { immediate?: boolean }) => void;
}

let current: SmoothScroller | null = null;

/** `LenisScroll` gọi lúc mount (instance) và unmount (`null`). */
export function setLenis(instance: SmoothScroller | null): void {
  current = instance;
}

/** Cuộn mượt tới toạ độ tuyệt đối `top` — qua Lenis nếu có, không thì native. */
export function smoothScrollTo(top: number): void {
  const target = Math.max(0, top);
  if (current) {
    current.scrollTo(target);
    return;
  }
  window.scrollTo({ top: target, behavior: 'smooth' });
}
