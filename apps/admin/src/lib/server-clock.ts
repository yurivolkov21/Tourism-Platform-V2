'use client';

import { useState } from 'react';

/** Mốc neo: giờ server lúc trang render, và đồng hồ đơn điệu của trình duyệt lúc nhận nó. */
interface ClockAnchor {
  iso: string;
  server: number;
  mono: number;
}

function anchorAt(iso: string): ClockAnchor {
  return { iso, server: Date.parse(iso), mono: performance.now() };
}

/**
 * "Bây giờ" theo đồng hồ SERVER: mốc giờ server lúc trang render cộng thời gian đã trôi đo bằng
 * `performance.now()` — đồng hồ đơn điệu, chỉnh giờ hệ thống không làm nó nhảy. Đồng hồ máy
 * người dùng lệch (giáo viên hay chỉnh đồng hồ máy để thử khi bảo vệ) không làm lệch ngày tự
 * điền, không biến bài định đăng ngay thành bài hẹn giờ (vòng review P4e-4).
 *
 * Trang refresh mang mốc mới thì neo lại ngay trong render — cùng khuôn `useVersionedForm`.
 */
export function useServerClock(serverNow: string): () => Date {
  const [anchor, setAnchor] = useState(() => anchorAt(serverNow));
  if (anchor.iso !== serverNow) setAnchor(anchorAt(serverNow));
  return () => new Date(anchor.server + (performance.now() - anchor.mono));
}
