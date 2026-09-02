'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tourism/ui/components/tooltip';

/**
 * Badge "Unprocessed" cho `processedAt` null (spec P4c §3-F8) — dùng ở cột
 * Processed của bảng VÀ field Processed của drawer, nên là một component
 * thay vì hai bản chép.
 *
 * Tooltip nói đúng nghĩa của null theo `PaymentsService.beginEvent`: đã ghi
 * sổ, handler chưa xong, provider sẽ retry. CHỈ qua `TooltipContent` — không
 * đặt thêm `title` (vòng vá review F8): Base UI đã nối trigger với nội dung
 * bằng `aria-describedby`, một `title` cùng chuỗi làm trình đọc màn hình đọc
 * hai lần và hover hiện hai bong bóng (native + Tooltip).
 */
const t = messages.admin.paymentEvents.list;

export function UnprocessedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="secondary" className="cursor-help px-1.5" />}>
        {t.unprocessed}
      </TooltipTrigger>
      <TooltipContent>{t.unprocessedHint}</TooltipContent>
    </Tooltip>
  );
}
