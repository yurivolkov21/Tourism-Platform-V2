'use client';

import { messages } from '@tourism/i18n';
import { ArrowUpIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { smoothScrollTo } from '@/lib/smooth-scroll';

// Convert từ Nexora layout/scroll-to-top.tsx (review #32): nút tròn nổi góc
// phải-dưới, hiện sau khi cuộn quá 500px, bấm cuộn mượt về đầu trang. Khác
// Nexora: bottom-6 thay bottom-20 (v2 chưa có bong bóng FloatingContact bên
// dưới); nhãn ở `messages.nav.backToTop` (W-09, 14/10).
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={messages.nav.backToTop}
      // Qua `smoothScrollTo` (Lenis-aware) — `window.scrollTo` trần bị quán tính
      // con lăn của Lenis ghi đè, bấm lúc đang trôi thì không lên (đo 19/08).
      onClick={() => smoothScrollTo(0)}
      className={`fixed right-5 bottom-6 z-(--z-sticky) flex size-11 cursor-pointer items-center justify-center rounded-full bg-background text-foreground shadow-(--shadow-dropdown) ring-1 ring-border transition-all duration-300 hover:text-primary-emphasis hover:ring-primary/40 ${
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUpIcon className="size-5" aria-hidden="true" />
    </button>
  );
}
