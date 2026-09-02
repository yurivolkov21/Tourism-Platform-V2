'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import {
  isStaleStateCode,
  type RetryAction as RetryActionFn,
  type RetryContractCode,
  retryConfirmRows,
  retryDialogCopy,
  retryErrorCopy,
} from '@/lib/outbox-retry';
import type { OutboxRowVM } from '@/lib/outbox-view';

/**
 * Nút Retry của MỘT hàng FAILED trong `/outbox` (spec P4c §3-F7) — hành vi
 * ghi duy nhất của vùng. Vòng đời lệnh (confirm, khoá khi đang bắn, ba lối
 * ra) nằm ở kit `ConfirmWriteDialog`; file này chỉ còn phần DOMAIN: ngữ cảnh
 * hàng, ba hệ quả, input `{ id }` và toast.
 *
 * Consumer đầu tiên KHÔNG có ô note (không truyền `noteId`): retry không
 * mang ghi chú đi đâu — một ô note không đi đâu là một lời hứa suông.
 *
 * Nút là `Button outline` chứ không phải `DecisionButton`: cặp tone
 * approve/deny của kit nói về một phán quyết hai chiều; retry là một hành
 * động vận hành trung tính, không có chiều đối lập để mà tô.
 *
 * Component KHÔNG tự import server action: nhận `retry` từ trang — test dựng
 * với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.outbox.retry;

/**
 * Nhận NGUYÊN `OutboxRowVM` (vòng vá review F7): VM thuần đã có đủ id/typeLabel/
 * recipient/dedupeKey/lastError, một interface con + một object literal cắt
 * tay ở bảng chỉ là hai chỗ nữa phải sửa khi dialog cần thêm field.
 */
export function RetryAction({ row, retry }: { row: OutboxRowVM; retry: RetryActionFn }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  /** Sau MỌI kết cục đã-chạm-server: kéo bảng tươi về, khoá nút tới khi xong. */
  function refreshList() {
    startRefresh(() => router.refresh());
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t.actionLabel(row.dedupeKey)}
        disabled={isRefreshing}
        onClick={() => setOpen(true)}
      >
        <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        {t.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<RetryContractCode>
          copy={retryDialogCopy()}
          rows={retryConfirmRows(row)}
          extra={
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              <li>{t.dialog.consequences.requeue}</li>
              <li>{t.dialog.consequences.worker}</li>
              <li>{t.dialog.consequences.lastError}</li>
            </ul>
          }
          onSubmit={async () => {
            const result = await retry({ id: row.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              // dedupeKey đọc từ RESPONSE — cùng nếp "kể lại chuyện server làm".
              toast: { title: t.toast.title, description: t.toast.body(result.dedupeKey) },
            };
          }}
          isStale={isStaleStateCode}
          errorCopy={retryErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={refreshList}
        />
      ) : null}
    </>
  );
}
