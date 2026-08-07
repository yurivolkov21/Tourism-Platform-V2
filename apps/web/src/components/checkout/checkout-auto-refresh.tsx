'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Đảo tự động màn `/checkout/success` khi webhook chưa về.
 *
 * Chỉ render ở mood `confirming`. Cách làm: `router.refresh()` theo chu kỳ —
 * server component cha đọc lại `bookings.byCode`, và khi status đã thành PAID
 * thì chính cây server đổi mood, component này biến mất. KHÔNG có state
 * "đã xong" ở phía client để lệch với server.
 *
 * Vì sao KHÔNG spinner toàn trang: khách vừa trả tiền xong: thứ họ cần thấy là
 * mã đặt chỗ và một câu bình tĩnh, không phải một cái vòng quay gợi ý rằng có
 * gì đó đang hỏng. Nội dung hiển thị ngay, việc làm mới diễn ra phía sau.
 *
 * Dừng sau `MAX_ATTEMPTS`: webhook không về sau ~1 phút thì lỗi nằm chỗ khác,
 * và một trang tự gọi lại vô hạn là thứ sẽ chạy quên trong tab bỏ ngỏ.
 */
const INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 12;

export function CheckoutAutoRefresh() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, router]);

  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      {messages.booking.success.refresh}
    </Button>
  );
}
