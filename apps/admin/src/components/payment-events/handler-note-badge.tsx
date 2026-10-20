'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tourism/ui/components/tooltip';

/**
 * Badge "Handler note" ở cột Processed của bảng `/payment-events` (review A1, 20/10). Ghi chú
 * handler (ADR-0006 AMEND 2a) là bề mặt operator DUY NHẤT của tiền không thành Refund row —
 * capture lệch tiền đã hoàn ngoài sổ, hay "operator must refund manually" khi tự hoàn thất bại.
 * Row ấy vẫn có `processedAt`, nên không vào "Unprocessed now", không bật "Needs attention";
 * trước bản này ghi chú chỉ hiện trong drawer, tức Owner phải mở từng row mới thấy.
 *
 * Mọi ghi chú hôm nay đều đi kèm `logger.error` ở `PaymentsService`, nên badge mang màu
 * destructive như dòng ghi chú trong drawer. Nhãn trùng nhãn field của drawer để người đọc nối
 * được hai chỗ. Nguyên văn ghi chú chỉ qua `TooltipContent`, không thêm `title` — cùng lý do
 * `UnprocessedBadge` (trình đọc màn hình đọc hai lần, hover hiện hai bong bóng).
 */
const t = messages.admin.paymentEvents.detail;

export function HandlerNoteBadge({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="destructive" className="cursor-help px-1.5" />}>
        {t.note}
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  );
}
