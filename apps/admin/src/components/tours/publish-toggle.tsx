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
  const [pending, setPending] = useState(false);
  /**
   * Giá trị LẠC QUAN đang hiển thị, hoặc `null` khi đang tin server.
   *
   * Trục so sánh là "server đã đuổi kịp chưa", KHÔNG phải "prop có vừa đổi
   * không". Bản trước giữ một gương `serverValue` rồi `setChecked` mỗi lần prop
   * khác gương, và hai ca hỏng theo:
   *
   * 1. Bấm bật → xong → bấm tắt ngay (lúc này `pending` đã nhả). Lượt
   *    `router.refresh()` của lệnh ĐẦU về sau, mang giá trị bật, và gương lật
   *    công tắc ngược lại giữa lúc lệnh tắt còn đang bay.
   * 2. Lệnh hỏng thì nhánh revert chỉ đặt lại `checked` mà để `serverValue`
   *    nguyên ở giá trị một lượt refresh khác vừa nâng lên. Từ đó
   *    `serverValue !== row.isPublished` không bao giờ đúng nữa, và công tắc
   *    kẹt sai cho tới khi tải lại CẢ trang.
   *
   * Với trục mới, một lượt refresh mang giá trị lạc hậu chỉ đơn giản không khớp
   * và bị bỏ qua, thay vì đè lên ý người dùng.
   */
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const checked = optimistic ?? row.isPublished;
  // Server đã nói đúng thứ ta đang hiển thị → thôi giữ lạc quan, trả quyền cho
  // prop. Chỉnh state NGAY TRONG RENDER thay vì `useEffect`: React chạy lại
  // render trước khi vẽ nên không có khung hình nào hiện giá trị cũ.
  //
  // `!pending` KHÔNG thừa: ngay sau một cú bấm, `optimistic` thường TÌNH CỜ
  // bằng `row.isPublished` — người dùng vừa bấm ngược về đúng giá trị server
  // đang giữ, vì prop chưa kịp đổi. Thiếu cổng này thì giá trị lạc quan bị xoá
  // ngay trong lượt render của chính cú bấm ấy, và lượt refresh kế tiếp mang
  // giá trị mới sẽ lật công tắc — đúng cái bug đang vá. Đo được bằng test
  // "refresh của lệnh TRƯỚC không đè lên cú bấm đang bay".
  if (!pending && optimistic !== null && optimistic === row.isPublished) setOptimistic(null);

  async function onCheckedChange(next: boolean) {
    if (pending) return;
    setOptimistic(next); // lạc quan
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
      // Bỏ lạc quan, trả về đúng thứ server đang nói — kể cả khi trong lúc chờ
      // đã có người khác đổi trạng thái tour này.
      setOptimistic(null);
      toast.error(setPublishedErrorCopy(result.code));
      // Trạng-thái-cũ hoặc kết cục KHÔNG RÕ: kéo dữ liệu tươi về trước khi ai
      // đó bấm lại mù (cùng luật ba lối ra của kit).
      if (isStaleOrUncertain(result.code)) router.refresh();
      return;
    }

    setOptimistic(result.isPublished);
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
