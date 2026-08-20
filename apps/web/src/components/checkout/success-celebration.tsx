'use client';

import { theme } from '@tourism/tokens/theme';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

/**
 * Pháo giấy "side cannons" cho trang thanh toán thành công (user chốt 20/08,
 * mẫu MagicUI confetti): hai họng hai mép trái/phải bắn chéo vào giữa ~3
 * giây, MỘT LẦN cho mỗi booking.
 *
 * Dùng `confetti()` GLOBAL của canvas-confetti (tự tạo canvas fixed,
 * pointer-events none, z-index cao) — đúng đường demo Side Cannons của
 * MagicUI. Đã THỬ đường component `<Confetti>` bọc canvas riêng (bản
 * @magicui trong @tourism/ui) và bỏ: dây ref→instance qua ba tầng lib mờ
 * mịt khi hỏng (đo 20/08: fire chạy, canvas trơ trơ), còn global là một
 * lời gọi thẳng vào thư viện.
 *
 * Ba chốt an toàn (phân tích 20/08):
 * - CHỈ render ở mood `confirmed` (cha quyết) — ăn mừng đơn PENDING là sai.
 * - Guard sessionStorage theo mã booking, ghi Ở KHUNG BẮN ĐẦU chứ không phải
 *   lúc effect chạy: StrictMode (dev) mount đôi hủy rAF trước khung đầu —
 *   ghi sớm là mount#2 thấy guard rồi bỏ qua, pháo không bao giờ nổ (đo
 *   20/08, tốn nguyên một phiên truy vết). `CheckoutAutoRefresh` remount
 *   island — không guard là nổ lại mỗi nhịp làm tươi.
 * - `prefers-reduced-motion` → không bắn.
 */
const CANNON_MS = 3000;

/** Màu lễ hội lấy từ token (hex bản RN) — không hardcode tay. */
const c = theme.colors.light;
const FESTIVE_COLORS = [c.primary, c.rating, c.sale, c.info, c.success];

/** Khoá đã-bắn trong sessionStorage — sống theo tab, chết khi đóng. */
function firedKey(bookingCode: string): string {
  return `confetti:${bookingCode}`;
}

export function SuccessCelebration({ bookingCode }: { bookingCode: string }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (sessionStorage.getItem(firedKey(bookingCode))) return;
    } catch {
      // sessionStorage bị chặn (private mode hiếm gặp) — vẫn bắn, chấp nhận
      // nổ lại nếu trang refresh.
    }

    const end = Date.now() + CANNON_MS;
    let raf = 0;
    const frame = () => {
      try {
        sessionStorage.setItem(firedKey(bookingCode), '1');
      } catch {}
      // Mẫu "Side Cannons" của MagicUI: mỗi khung vài hạt từ hai mép.
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: FESTIVE_COLORS,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: FESTIVE_COLORS,
      });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bookingCode]);

  // Không render gì — canvas do canvas-confetti tự quản khi bắn.
  return null;
}
