'use client';

import { EnquiryStatusSchema, type EnquiryStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { ENQUIRY_STATUS_ICONS } from '@/components/enquiries/status-icons';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { Picker } from '@/components/kit/picker';
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
 * dựng với hàm giả, không mock `next/headers`. Trạng thái server đổi (sau một
 * lần ghi + refresh) thì ô Select đặt lại về trạng thái MỚI thay vì giữ một
 * lựa chọn đã cũ.
 *
 * Đặt lại bằng state chứ không bằng `key={status}` ở trang (cách cũ, tới
 * 13/10): `key` dựng lại cả cụm, và nút "Change status" mà hộp vừa trả focus
 * về biến mất ngay giữa tay người dùng — focus bàn phím rơi về <body>. Nay cụm
 * sống qua lượt làm mới, và một lệnh đã chạm server thì hộp trả focus về ô
 * Select (đang hiện trạng thái mới): nút kia lúc ấy khoá, vì chưa chọn gì khác.
 */
const t = messages.admin.enquiries.setStatus;

const STATUS_ITEMS = EnquiryStatusSchema.options.map((status) => ({
  label: enquiryStatusLabel(status),
  value: status,
  icon: ENQUIRY_STATUS_ICONS[status],
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
  /** Trạng thái server của lượt vẽ trước — đổi thì đặt lại lựa chọn (khuôn "điều chỉnh state theo prop" của React). */
  const [shownStatus, setShownStatus] = useState(status);
  if (shownStatus !== status) {
    setShownStatus(status);
    setTarget(status);
  }
  const [open, setOpen] = useState(false);
  /**
   * Lệnh đã chạm server và hộp sắp đóng: focus về ô Select chứ không về nút. Gán trong `onSettled`
   * — kit gọi nó ngay sau `onClose` cùng một nhịp, trước khi React kịp gỡ hộp.
   */
  const wrote = useRef(false);
  const changed = target !== status;
  const pickerId = `enquiry-status-${id}`;

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
      <Picker
        id={pickerId}
        label={t.label}
        value={target}
        options={STATUS_ITEMS}
        onValueChange={select}
        // Cao 32px của biến thể field, bằng nút "Change status" đứng cạnh.
        className="w-fit"
      />
      <Button
        type="button"
        disabled={!changed || isRefreshing}
        onClick={() => {
          wrote.current = false;
          setOpen(true);
        }}
      >
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
          // Base UI gọi hàm này lúc hộp gỡ; `true` là đích mặc định (nút Change status).
          finalFocus={() => (wrote.current ? document.getElementById(pickerId) : true)}
          onClose={() => setOpen(false)}
          onSettled={() => {
            wrote.current = true;
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
