'use client';

import { Button } from '@tourism/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tourism/ui/components/tooltip';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  type ConfirmWriteCopy,
  ConfirmWriteDialog,
  type ConfirmWriteResult,
  type ConfirmWriteRow,
} from '@/components/kit/confirm-write-dialog';
import type { TransportFailureCode } from '@/lib/api/write-error';

/**
 * Nút Delete của một hàng bảng catalog kèm hộp xác nhận giọng đỏ (spec 2026-10-05 §3.3,
 * ADR-0053 §5). Kit vì hai bảng (danh mục, điểm đến) dùng y hệt.
 *
 * Hàng còn tour (`blockedReason` khác `null`) thì nút khoá kiểu `aria-disabled`
 * (`focusableWhenDisabled`): vẫn nhận focus, và `aria-disabled:pointer-events-auto` cho nó
 * nhận chuột — thiếu nó thì biến thể `aria-disabled:pointer-events-none` của `Button` nuốt
 * mất cú rê, và tooltip, thứ DUY NHẤT nói vì sao không bấm được, không bao giờ hiện. Server
 * vẫn là phán quyết cuối: bảng có thể cũ hơn DB.
 */
export function DeleteRowAction<Code extends string>({
  label,
  actionLabel,
  blockedReason,
  disabled,
  dialog,
  onSettled,
}: {
  /** Chữ trên nút ("Delete"). */
  label: string;
  /** Tên đọc-màn-hình mang tên hàng ("Delete Cruises"). */
  actionLabel: string;
  /** Lý do không xoá được; `null` là xoá được. */
  blockedReason: string | null;
  /** Bảng đang kéo dữ liệu tươi về — khoá như các nút khác của hàng. */
  disabled: boolean;
  dialog: {
    copy: ConfirmWriteCopy & { noteLabel?: undefined };
    rows: ConfirmWriteRow[];
    isStale: (code: Code | TransportFailureCode) => boolean;
    errorCopy: (code: Code | TransportFailureCode) => string;
    onSubmit: () => Promise<ConfirmWriteResult<Code>>;
  };
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const blocked = blockedReason !== null;

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={actionLabel}
      disabled={disabled || blocked}
      // Khoá mà vẫn nhận focus — cùng lý do các nút khác của hàng (vòng review F15).
      focusableWhenDisabled
      className="text-destructive-emphasis hover:text-destructive-emphasis aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed"
      onClick={() => setOpen(true)}
    >
      <Trash2Icon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <>
      {blocked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={button} />
            <TooltipContent>{blockedReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {open ? (
        <ConfirmWriteDialog<Code>
          copy={dialog.copy}
          rows={dialog.rows}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={dialog.isStale}
          errorCopy={dialog.errorCopy}
          onSubmit={dialog.onSubmit}
          onClose={() => setOpen(false)}
          onSettled={onSettled}
        />
      ) : null}
    </>
  );
}
