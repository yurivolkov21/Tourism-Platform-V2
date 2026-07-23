'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

// Convert từ PrebuiltUI "Dark Action Banner" (user chọn, review vòng 1 #4):
// dải khuyến mãi fixed trên navbar — thông điệp + nút hành động + nút đóng.
// Màu đảo tông bằng token (bg mực/chữ sương — dark mode tự đảo ngược lại).
// Navbar đọc biến --banner-offset (globals.css) để nằm dưới banner khi banner
// còn mở; đóng banner thì biến về 0 và navbar trượt lên (transition sẵn có).
export function AnnouncementBanner() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    document.documentElement.style.setProperty('--banner-offset', open ? '2.5rem' : '0px');
    return () => {
      document.documentElement.style.setProperty('--banner-offset', '0px');
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-(--z-toast) flex h-10 items-center bg-foreground px-4 text-sm text-background md:px-8">
      <div className="mx-auto flex w-full max-w-(--container-content) items-center justify-between gap-3">
        <p className="truncate">
          <span className="font-semibold">Autumn sale</span> — 20% off selected departures this week
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#tours"
            className="rounded-full bg-background px-4 py-1 text-xs font-semibold text-foreground transition hover:opacity-85"
          >
            View deals
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Dismiss announcement"
            className="cursor-pointer rounded-sm p-1 transition hover:opacity-70"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
