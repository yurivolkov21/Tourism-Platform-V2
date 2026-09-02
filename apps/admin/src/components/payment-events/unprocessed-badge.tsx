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
 * sổ, handler chưa xong, provider sẽ retry. `title` đặt kèm để nội dung tới
 * được cả nơi không hover (mobile, trình đọc màn hình đọc thuộc tính).
 */
const t = messages.admin.paymentEvents.list;

export function UnprocessedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant="secondary" className="cursor-help px-1.5" />}
        title={t.unprocessedHint}
      >
        {t.unprocessed}
      </TooltipTrigger>
      <TooltipContent>{t.unprocessedHint}</TooltipContent>
    </Tooltip>
  );
}
