'use client';

import { useEffect, useState } from 'react';

// v2 đổi theme bằng cách bật/tắt class `.dark` trên <html> (script chặn nháy
// ở app/layout.tsx + AnimatedThemeToggler), KHÔNG dùng next-themes — nên phải
// tự theo dõi class đó thay vì gọi useTheme(). Logic bê từ Nexora
// (libs/web/ui/.../map.tsx useResolvedTheme) vì cơ chế trùng khớp.

export type Theme = 'light' | 'dark';

function getDocumentTheme(): Theme | null {
  if (typeof document === 'undefined') return null;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (document.documentElement.classList.contains('light')) return 'light';
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Theme đang hiển thị, đọc ĐỒNG BỘ ngay lúc gọi. Dùng cho thứ phải đúng màu
 * từ lần vẽ đầu (vd style của MapLibre lúc dựng map) — chờ state của hook thì
 * map đã nháy sáng rồi mới sang tối.
 */
export function resolveThemeNow(): Theme {
  return getDocumentTheme() ?? getSystemTheme();
}

/** Theme đang hiển thị thật, tự cập nhật khi user bấm nút đổi theme. */
export function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(resolveThemeNow);

  useEffect(() => {
    // Nút đổi theme sửa class trên <html> — MutationObserver bắt được, còn
    // event listener thì không có gì để nghe.
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) setTheme(docTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Khi user CHƯA chọn thủ công thì bám theo cài đặt hệ điều hành.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getDocumentTheme()) setTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  return theme;
}
