'use client';

import { formatPrintDateTime } from '@tourism/ui/lib/print-time';
import { useEffect, useState } from 'react';

/**
 * Giờ in (G40, ADR-0057 §3): đóng dấu ở client lúc mount và lại lúc `beforeprint` — render ở server
 * thì lệch hydration và in ra giờ TẢI trang thay cho giờ IN. Nhận chuỗi (`prefix`, `timeZone`), không
 * nhận hàm: component client nhận props từ Server Component.
 */
export function PrintedAt({ prefix, timeZone }: { prefix: string; timeZone: string }) {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setStamp(formatPrintDateTime(new Date(), timeZone));
    update();
    window.addEventListener('beforeprint', update);
    return () => window.removeEventListener('beforeprint', update);
  }, [timeZone]);

  return <span data-slot="printed-at">{stamp === null ? null : `${prefix} ${stamp}`}</span>;
}
