'use client';

import { useEffect, useState } from 'react';

// v2 KHÔNG dùng next-themes: theme đổi bằng cách bật/tắt DUY NHẤT class `.dark`
// trên <html> (script chặn nháy ở app/layout.tsx + AnimatedThemeToggler của
// @tourism/ui). Không nơi nào thêm class `light`, nên "vắng .dark" = sáng.
//
// CẢNH BÁO PORT: bản đầu bê từ Nexora còn dò thêm class `light` và nghe
// prefers-color-scheme, vì Nexora có <ThemeProvider attribute="class">
// (next-themes) ghi CẢ HAI class. Bê nguyên sang v2 thì chiều dark→light kẹt:
// gỡ `.dark` ra chỉ còn null, guard nuốt mất, bản đồ ở lại tile tối trên trang
// sáng cho tới khi reload.
//
// Cũng CỐ Ý không nghe prefers-color-scheme: phần còn lại của site chỉ phản ứng
// với class, nên nếu bản đồ tự đổi theo hệ điều hành giữa phiên thì bản đồ sẽ
// tối trong khi trang vẫn sáng. Class là nguồn sự thật DUY NHẤT.

export type Theme = 'light' | 'dark';

/**
 * Theme đang hiển thị, đọc ĐỒNG BỘ ngay lúc gọi. Dùng cho thứ phải đúng màu
 * từ lần vẽ đầu (vd style của MapLibre lúc dựng map) — chờ state của hook thì
 * bản đồ đã nháy sáng rồi mới sang tối.
 *
 * SSR: trả `'light'` khi không có `document`. Consumer PHẢI là client-only
 * (`dynamic(..., { ssr: false })`) để tránh lệch hydration.
 */
export function resolveThemeNow(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Theme đang hiển thị, tự cập nhật khi user bấm nút đổi theme.
 *
 * SSR: giá trị khởi tạo đọc từ `resolveThemeNow()` nên server luôn ra
 * `'light'`. Consumer PHẢI là client-only (`dynamic(..., { ssr: false })`),
 * nếu không sẽ lệch hydration khi khách đang ở theme tối.
 */
export function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(resolveThemeNow);

  useEffect(() => {
    // Nút đổi theme sửa class trên <html> — MutationObserver bắt được, còn
    // event listener thì không có gì để nghe.
    const observer = new MutationObserver(() => setTheme(resolveThemeNow()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    // Class có thể đã đổi giữa lần render đầu và lúc effect kịp chạy.
    setTheme(resolveThemeNow());
    return () => observer.disconnect();
  }, []);

  return theme;
}
