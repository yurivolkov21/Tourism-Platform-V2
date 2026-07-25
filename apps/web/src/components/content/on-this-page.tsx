'use client';

import { cn } from '@tourism/ui/lib/utils';
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/toc';

// Mục lục sticky cho trang nội dung dài — đặt bên PHẢI theo mẫu Vercel
// (Nexora để bên trái). Scroll-spy bằng IntersectionObserver: rootMargin cắt
// 96px trên (chiều cao navbar pill) và 70% dưới nên mục "đang đọc" là mục gần
// đỉnh màn nhất, không phải mục vừa lấp ló đáy.
export function OnThisPage({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | undefined>(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-4 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                '-ml-px flex gap-2.5 border-l-2 py-1.5 pl-4 text-pretty transition-colors',
                active === item.id
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="font-mono text-xs tabular-nums opacity-60">{item.index}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
