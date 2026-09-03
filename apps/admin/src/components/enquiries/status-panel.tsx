'use client';

import { EnquiryStatusSchema, type EnquiryStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { ToolbarSelect } from '@/components/kit/toolbar-select';
import { enquiryStatusLabel } from '@/lib/enquiries-view';
import {
  isSetStatusStale,
  type SetStatusAction,
  type SetStatusContractCode,
  setStatusConfirmRows,
  setStatusDialogCopy,
  setStatusErrorCopy,
  setStatusToast,
} from '@/lib/enquiries-write';

/**
 * Ô đổi trạng thái của `/enquiries/[id]` (spec P4c §3-F9) — hành vi ghi thứ
 * nhất của vùng. Vòng đời lệnh (confirm, khoá khi đang bắn, ba lối ra) nằm ở
 * kit `ConfirmWriteDialog`; file này chỉ còn phần DOMAIN: chọn đích, ba hệ
 * quả, input `{ id, status }` và toast.
 *
 * KHÔNG có ô note (không truyền `noteId`): audit trail đã ghi ai/lúc nào/từ
 * đâu tới đâu, còn lời giải thích thì thuộc về thread note ngay bên dưới —
 * hai ô ghi chú trên một trang là hai chỗ người sau phải nhớ đọc.
 *
 * Nút bị KHOÁ khi ô Select vẫn đang ở trạng thái hiện tại: server coi lệnh
 * trùng trạng thái là no-op có chủ đích (dành cho tab cũ của một admin khác),
 * nhưng mời người đang nhìn thẳng vào màn hình xác nhận một lệnh không làm gì
 * là mời họ mất một cú bấm để học điều đó.
 *
 * Component KHÔNG tự import server action: nhận `setStatus` từ trang — test
 * dựng với hàm giả, không mock `next/headers`. Trang truyền `key={status}`
 * nên sau mỗi lần ghi thành công + refresh, ô Select tự sinh lại từ trạng
 * thái MỚI thay vì giữ một lựa chọn đã cũ.
 */
const t = messages.admin.enquiries.setStatus;

const STATUS_ITEMS = EnquiryStatusSchema.options.map((status) => ({
  label: enquiryStatusLabel(status),
  value: status,
}));

export function EnquiryStatusPanel({
  id,
  name,
  status,
  setStatus,
}: {
  id: string;
  /** Tên lead — dialog phải nêu rõ đang đổi trạng thái của AI. */
  name: string;
  /** Trạng thái hiện tại theo server. */
  status: EnquiryStatusValue;
  setStatus: SetStatusAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [target, setTarget] = useState<EnquiryStatusValue>(status);
  const [open, setOpen] = useState(false);
  const changed = target !== status;

  /** Sau MỌI kết cục đã-chạm-server: kéo trang tươi về, khoá nút tới khi xong. */
  function refresh() {
    startRefresh(() => router.refresh());
  }

  function select(next: string) {
    // `safeParse` chứ không `parse`: value lạ từ Select rơi êm về trạng thái
    // hiện tại thay vì ném ZodError giữa event handler (nếp toolbar).
    const parsed = EnquiryStatusSchema.safeParse(next);
    setTarget(parsed.success ? parsed.data : status);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <ToolbarSelect
        id={`enquiry-status-${id}`}
        label={t.label}
        value={target}
        items={STATUS_ITEMS}
        onSelect={select}
      />
      <Button type="button" disabled={!changed || isRefreshing} onClick={() => setOpen(true)}>
        {t.action}
      </Button>
      {open && changed ? (
        <ConfirmWriteDialog<SetStatusContractCode>
          copy={setStatusDialogCopy()}
          rows={setStatusConfirmRows({ name, from: status, to: target })}
          extra={
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              <li>{t.dialog.consequences.audit}</li>
              <li>{t.dialog.consequences.stats}</li>
              <li>{t.dialog.consequences.free}</li>
            </ul>
          }
          onSubmit={async () => {
            const result = await setStatus({ id, status: target });
            if (!result.ok) return { ok: false, code: result.code };
            // Tên + trạng thái + `changed` đọc từ RESPONSE — cùng nếp "kể lại
            // chuyện server làm": no-op (tab cũ, người khác đổi trước) thì
            // toast nói "không có gì đổi", không phải "Status updated".
            return { ok: true, toast: setStatusToast(result) };
          }}
          isStale={isSetStatusStale}
          errorCopy={setStatusErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={refresh}
        />
      ) : null}
    </div>
  );
}
