'use client';

import { messages } from '@tourism/i18n';
import { Switch } from '@tourism/ui/components/switch';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome } from '@/lib/api/write-error';
import {
  isSetPublishedStale,
  type SetPublishedAction,
  type SetPublishedFailureCode,
  setPublishedErrorCopy,
  setPublishedToast,
} from '@/lib/tours-publish';
import type { TourRowVM } from '@/lib/tours-view';

/**
 * Công tắc bán / ngừng bán của MỘT hàng trong `/tours` (spec P4e-1 §3-F11) —
 * hành vi ghi duy nhất của vùng.
 *
 * KHÔNG đi qua `ConfirmWriteDialog` như ba vùng ghi trước (lý do đầy đủ ở
 * `lib/tours-publish.ts`): thao tác này nhẹ, hoàn tác được bằng đúng cú bấm
 * ngược lại, và vận hành cần rút một tour khỏi kệ NGAY khi có chuyện. Đổi lại,
 * file này phải tự lo phần mà kit vẫn lo hộ, và cả ba đều là luật đã trả giá ở
 * các vòng review trước:
 *
 * - **Lạc quan, nhưng hoàn nguyên khi hỏng.** Một công tắc kẹt ở trạng thái
 *   sai sau lỗi mạng là công tắc nói dối về việc tour còn đang bán hay không.
 * - **`pending` là CỔNG.** Bấm đúp chỉ bắn một lệnh.
 * - **Settle theo RESPONSE, không theo cú bấm.** Tab khác vừa đổi trạng thái
 *   thì server trả về sự thật của nó, và công tắc phải theo sự thật ấy.
 *
 * Component KHÔNG tự import server action: nhận `setPublished` từ bảng — test
 * dựng với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.tours.publish;

export function PublishToggle({
  row,
  setPublished,
}: {
  row: TourRowVM;
  setPublished: SetPublishedAction;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(row.isPublished);
  const [pending, setPending] = useState(false);
  // Đồng bộ lại khi server gửi hàng mới (sau `router.refresh()`, hoặc đổi
  // trang/lọc dùng lại cùng một instance): chỉnh state NGAY TRONG RENDER thay
  // vì `useEffect` — React chạy lại render trước khi vẽ, nên không có một
  // khung hình nào hiện giá trị cũ.
  const [serverValue, setServerValue] = useState(row.isPublished);
  if (serverValue !== row.isPublished) {
    setServerValue(row.isPublished);
    setChecked(row.isPublished);
  }

  async function onCheckedChange(next: boolean) {
    if (pending) return;
    const previous = checked;
    setChecked(next); // lạc quan
    setPending(true);

    let result: Awaited<ReturnType<SetPublishedAction>>;
    try {
      result = await setPublished({ id: row.id, isPublished: next });
    } catch {
      // Action ném ⇒ không biết lệnh đã đi tới đâu — cùng luật với
      // `useConfirmWrite`: coi như GENERIC.
      result = { ok: false, code: 'GENERIC' };
    }
    setPending(false);

    if (!result.ok) {
      setChecked(previous);
      toast.error(setPublishedErrorCopy(result.code));
      // Trạng-thái-cũ hoặc kết cục KHÔNG RÕ: kéo dữ liệu tươi về trước khi ai
      // đó bấm lại mù (cùng luật ba lối ra của kit).
      if (isStaleOrUncertain(result.code)) router.refresh();
      return;
    }

    setChecked(result.isPublished);
    toast.success(setPublishedToast(row.title, result));
    // Cột "Open departures" và cả các hàng khác không đổi theo lệnh này, nhưng
    // bảng vẫn phải tươi: bộ lọc "Off sale" co lại đúng sau mỗi lần bấm.
    router.refresh();
  }

  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={t.toggleLabel(row.title)}
      onCheckedChange={(next) => {
        void onCheckedChange(next);
      }}
    />
  );
}

/** Hai loại mã đều dẫn tới cùng một việc: nhìn dữ liệu tươi trước khi thử lại. */
function isStaleOrUncertain(code: SetPublishedFailureCode): boolean {
  return isSetPublishedStale(code) || isUncertainOutcome(code);
}
