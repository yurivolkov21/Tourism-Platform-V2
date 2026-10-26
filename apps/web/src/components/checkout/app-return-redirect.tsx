'use client';

import { messages } from '@tourism/i18n';
import { useEffect } from 'react';

/**
 * Chuyển ngay về app mobile khi trang mở (ADR-0062), kèm một liên kết bấm tay phòng trình duyệt
 * chặn chuyển hướng tự động sang scheme lạ. `href` đã được server kiểm bằng luật của contract —
 * component này không tự dựng URL nào.
 */
export function AppReturnRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <a
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-medium text-primary-foreground"
    >
      {messages.booking.appReturn.cta}
    </a>
  );
}
