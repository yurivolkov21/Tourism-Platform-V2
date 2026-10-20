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
 * Nhịp: 5 giây trong phút đầu (Stripe thường về trong vài giây), rồi 30 giây
 * tới mốc 10 phút và dừng hẳn. Review L3 (20/10): bản cũ tắt hẳn sau 60 giây
 * trong khi trang vẫn in "This page updates automatically" — PayPal cần HAI
 * webhook (APPROVED rồi CAPTURE.COMPLETED) và sandbox có lúc về chậm hơn một
 * phút. Vẫn phải có trần: một trang tự gọi lại vô hạn là thứ sẽ chạy quên
 * trong tab bỏ ngỏ.
 *
 * `auto={false}`: chỉ nút Refresh, không hẹn giờ. Thẻ chờ (G42) vẽ hành động hai lần (ô gọn dưới
 * `xl`, cột phải từ `xl`) và CSS chỉ giấu chứ không gỡ bản kia — hai bộ hẹn giờ là hai lượt
 * `router.refresh()` mỗi nhịp, nên chỉ một bản được tự làm tươi.
 */
const FAST_INTERVAL_MS = 5_000;
const FAST_ATTEMPTS = 12;
const SLOW_INTERVAL_MS = 30_000;
// 12 × 5s + 18 × 30s = 10 phút.
const MAX_ATTEMPTS = 30;

export function CheckoutAutoRefresh({ auto = true }: { auto?: boolean }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!auto || attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(
      () => {
        setAttempts((n) => n + 1);
        router.refresh();
      },
      attempts < FAST_ATTEMPTS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [auto, attempts, router]);

  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      {messages.booking.success.refresh}
    </Button>
  );
}
