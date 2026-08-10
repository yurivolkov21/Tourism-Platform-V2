'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useState } from 'react';

/**
 * Nút chép mã đặt chỗ (booking code) vào clipboard, dùng cạnh khối voucher ở
 * `CheckoutShell`. Nhãn tự đổi `Copy code → Copied` trong 2 giây rồi quay lại
 * — cùng pattern với `ShareRow` (blog), nhưng tách riêng vì đây là component
 * dùng lại ở nhiều màn checkout/account, không gắn với ngữ cảnh chia sẻ.
 */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const t = messages.booking.success;

  const copy = async () => {
    // Origin không bảo mật (vd IP LAN) không có navigator.clipboard — bọc
    // try/catch, thất bại thì im lặng giữ nguyên nhãn "Copy code".
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Bỏ qua — khách vẫn có thể tự bôi đen mã để chép.
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {/* aria-live: trình đọc màn hình cần được báo khi nhãn đổi thành Copied */}
      <span aria-live="polite">{copied ? t.copied : t.copyCode}</span>
    </Button>
  );
}
