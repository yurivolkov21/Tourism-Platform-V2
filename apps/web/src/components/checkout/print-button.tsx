'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { PrinterIcon } from 'lucide-react';

/**
 * Nút in hoá đơn. Client island bé nhất có thể — chỉ tồn tại vì `window.print()`
 * cần chạy ở trình duyệt.
 *
 * KHÔNG có nút "Download PDF" đi kèm, và đó là chủ đích: repo không sinh PDF ở
 * đâu cả, nên một nút như vậy sẽ là nút chết. Hộp thoại in của mọi trình duyệt
 * đều có "Save as PDF", nên nhu cầu "khách cần hoá đơn để lưu" vẫn được phục vụ
 * mà không phải hứa một tính năng chưa có.
 *
 * Bản thân nút bị ẩn khi in (`print:hidden`) — bấm vào giấy thì không được.
 */
export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <PrinterIcon />
      {messages.booking.success.print}
    </Button>
  );
}
