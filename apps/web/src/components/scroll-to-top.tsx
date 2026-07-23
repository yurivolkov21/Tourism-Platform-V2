'use client';

import { ArrowUpIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

// Convert từ Nexora layout/scroll-to-top.tsx (review #32): nút tròn nổi góc
// phải-dưới, hiện sau khi cuộn quá 500px, bấm cuộn mượt về đầu trang. Khác
// Nexora: bottom-6 thay bottom-20 (v2 chưa có bong bóng FloatingContact bên
// dưới) và copy tiếng Anh hardcode (gom về @tourism/i18n khi làm i18n sweep).
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
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed right-5 bottom-6 z-(--z-sticky) flex size-11 cursor-pointer items-center justify-center rounded-full bg-background text-foreground shadow-(--shadow-dropdown) ring-1 ring-border transition-all duration-300 hover:text-primary hover:ring-primary/40 ${
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUpIcon className="size-5" aria-hidden="true" />
    </button>
  );
}
