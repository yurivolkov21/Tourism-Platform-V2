'use client';

import { formatPrintDateTime } from '@tourism/ui/lib/print-time';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Giờ in (G40, ADR-0057 §3): đóng dấu ở client lúc mount và lại lúc `beforeprint` — render ở server
 * thì lệch hydration và in ra giờ TẢI trang thay cho giờ IN. Nhận chuỗi (`prefix`, `timeZone`), không
 * nhận hàm: component client nhận props từ Server Component.
 *
 * `beforeprint` cập nhật bằng `flushSync`: trình duyệt dựng bản in NGAY sau sự kiện, còn React hẹn
 * cập nhật thường sang task sau (sự kiện này không có trong bảng ưu tiên của React; nút Print gọi
 * `window.print()` ngay trong click nên cả cập nhật đồng bộ cũng chỉ xả sau khi hộp in đóng) — giấy
 * từng in giờ tải trang (review G40).
 */
export function PrintedAt({ prefix, timeZone }: { prefix: string; timeZone: string }) {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const stampNow = () => setStamp(formatPrintDateTime(new Date(), timeZone));
    stampNow();
    const onBeforePrint = () => flushSync(stampNow);
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [timeZone]);

  return <span data-slot="printed-at">{stamp === null ? null : `${prefix} ${stamp}`}</span>;
}
