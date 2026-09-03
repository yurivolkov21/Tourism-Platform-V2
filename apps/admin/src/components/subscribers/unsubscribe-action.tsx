'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { MailXIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { formatDateTime } from '@/lib/bookings-view';
import {
  isUnsubscribeStale,
  type UnsubscribeAction as UnsubscribeActionFn,
  type UnsubscribeContractCode,
  unsubscribeConfirmRows,
  unsubscribeDialogCopy,
  unsubscribeErrorCopy,
} from '@/lib/subscribers-unsubscribe';
import type { SubscriberRowVM } from '@/lib/subscribers-view';

/**
 * Nút Unsubscribe của MỘT hàng còn nhận tin trong `/subscribers` (spec P4c
 * §3-F10) — hành vi ghi duy nhất của vùng. Vòng đời lệnh (confirm, khoá khi
 * đang bắn, ba lối ra) nằm ở kit `ConfirmWriteDialog`; file này chỉ còn phần
 * DOMAIN: ngữ cảnh hàng, ba hệ quả, input `{ id }` và toast.
 *
 * KHÔNG có ô note (không truyền `noteId`), cùng lý do với retry outbox: bảng
 * `subscribers` không có cột nào lưu ghi chú, nên một ô note ở đây là lời hứa
 * suông.
 *
 * `submitVariant="destructive"`: lệnh này lấy đi một thứ đang có thật — quyền
 * nhận thư của một người — và admin KHÔNG có nút nào hoàn tác (chỉ chính chủ
 * hộp thư mới đăng ký lại được). Khác retry outbox (hành động vận hành trung
 * tính, sai thì retry lại).
 *
 * Component KHÔNG tự import server action: nhận `unsubscribe` từ trang — test
 * dựng với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.subscribers.unsubscribe;

export function UnsubscribeAction({
  row,
  unsubscribe,
}: {
  row: SubscriberRowVM;
  unsubscribe: UnsubscribeActionFn;
}) {
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
        aria-label={t.actionLabel(row.email)}
        disabled={isRefreshing}
        onClick={() => setOpen(true)}
      >
        <MailXIcon data-icon="inline-start" aria-hidden="true" />
        {t.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<UnsubscribeContractCode>
          copy={unsubscribeDialogCopy()}
          rows={unsubscribeConfirmRows(row)}
          submitVariant="destructive"
          extra={
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              <li>{t.dialog.consequences.stops}</li>
              <li>{t.dialog.consequences.kept}</li>
              <li>{t.dialog.consequences.oneWay}</li>
            </ul>
          }
          onSubmit={async () => {
            const result = await unsubscribe({ id: row.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: {
                title: t.toast.title,
                // Mốc đọc từ RESPONSE (dòng consent server vừa ghi), email đọc
                // từ hàng admin vừa bấm — response cố ý không chở PII về.
                description: t.toast.body(row.email, formatDateTime(result.unsubscribedAt)),
              },
            };
          }}
          isStale={isUnsubscribeStale}
          errorCopy={unsubscribeErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={refreshList}
        />
      ) : null}
    </>
  );
}
