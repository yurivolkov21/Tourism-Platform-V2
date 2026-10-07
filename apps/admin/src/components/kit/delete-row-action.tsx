'use client';

import { Button } from '@tourism/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tourism/ui/components/tooltip';
import { Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
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
 *
 * Ba điều của review cuối nhánh:
 * - Cây Tooltip luôn dựng, chỉ `disabled` khi xoá được. Đổi kiểu phần tử theo `blocked` thì
 *   React dựng lại nút, và focus rơi về `body` đúng lúc bảng làm mới sau một lần `IN_USE`. Đó
 *   mới là nửa của nút; nửa kia thuộc về bảng: ô chứa nút không được dựng lại khi làm mới.
 *   Server action đổi danh tính sau mỗi `router.refresh()`, nên hai bảng catalog đưa lệnh ghi
 *   qua context chứ không qua cột (review D1) — một bảng đóng lệnh vào cột là mất focus như cũ.
 * - Lý do còn nằm trong một span `hidden` mà nút trỏ tới bằng `aria-describedby` (Ruling F-e):
 *   tooltip chỉ hiện khi rê hay focus, và Base UI không nối popup vào nút.
 * - Nhận chuột thì cũng ăn `hover:` và `active:` của biến thể outline; nút khoá giữ nền lúc nghỉ
 *   của từng giao diện và không nhún khi nhấn, như mục chưa mở ở `nav-main.tsx`.
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
  const reasonId = useId();
  const blocked = blockedReason !== null;

  return (
    <>
      <TooltipProvider>
        <Tooltip disabled={!blocked}>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={actionLabel}
                aria-describedby={blocked ? reasonId : undefined}
                disabled={disabled || blocked}
                // Khoá mà vẫn nhận focus — cùng lý do các nút khác của hàng (vòng review F15).
                focusableWhenDisabled
                className="text-destructive-emphasis hover:text-destructive-emphasis aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:hover:bg-background aria-disabled:active:translate-y-0 dark:aria-disabled:hover:bg-input/30"
                onClick={() => setOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                {label}
              </Button>
            }
          />
          <TooltipContent>{blockedReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {blocked ? (
        <span id={reasonId} hidden>
          {blockedReason}
        </span>
      ) : null}

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
