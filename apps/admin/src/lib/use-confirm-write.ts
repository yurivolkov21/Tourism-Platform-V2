'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome, type TransportFailureCode } from '@/lib/api/write-error';

/**
 * VÒNG ĐỜI một lệnh ghi của admin — rút từ `ConfirmWriteDialog` ở vòng vá
 * review F5, vì `RefundDialog` (F2, đường tiền thật) là bản chép thứ ba của
 * đúng máy này mà không dùng được kit dialog (nó có HAI bước + form số tiền,
 * không vừa khuôn một-bước của kit). Hook giữ luật, còn dựng dialog thế nào
 * là việc của từng nơi tiêu thụ.
 *
 * Luật (đã trả giá qua các vòng review F2→F5, đừng nới):
 * - `pending` là CỔNG: bấm đúp chỉ bắn một lệnh; đang bắn thì `onOpenChange`
 *   nuốt mọi cú đóng (Esc/click ngoài) — đóng được là thông báo lỗi về sau
 *   ghi vào một dialog đã đóng.
 * - `try` chỉ ôm ĐÚNG lời gọi lệnh: nhánh hậu-thành-công (onClose/toast/
 *   onSettled) ném không được quy thành GENERIC rồi chạy đúp.
 * - BA lối ra: thành công → đóng + toast.success + `onSettled`; mã
 *   TRẠNG-THÁI-CŨ (`isStale`, vùng khai) hoặc KHÔNG RÕ (GENERIC) → đóng +
 *   toast.error + `onSettled` (nhìn dữ liệu tươi trước khi thử lại — bấm-lại
 *   mù là công thức ghi đúp); còn lại → `failure` ở lại cho dialog hiện.
 */

export type ConfirmWriteOutcome<Code extends string> =
  | { ok: true; toast: { title: string; description?: string } }
  | { ok: false; code: Code | TransportFailureCode };

export function useConfirmWrite<Code extends string>(options: {
  isStale: (code: Code | TransportFailureCode) => boolean;
  errorCopy: (code: Code | TransportFailureCode) => string;
  /** Đóng dialog + quên state nhập của nó — hook gọi ở mọi lối ra rời dialog. */
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}) {
  const [failure, setFailure] = useState<Code | TransportFailureCode | null>(null);
  const [pending, setPending] = useState(false);

  function onOpenChange(next: boolean) {
    if (pending) return;
    if (!next) options.onClose();
  }

  /** Bắn một lệnh. `command` ném ⇒ coi như GENERIC (không biết đã tới đâu). */
  async function run(command: () => Promise<ConfirmWriteOutcome<Code>>) {
    if (pending) return;
    setPending(true);
    setFailure(null);
    // Khởi tạo GENERIC để TS khỏi chứng minh tương quan giữa các nhánh —
    // mọi đường không-success đều gán lại trước khi đọc.
    let failureCode: Code | TransportFailureCode = 'GENERIC';
    let success: Extract<ConfirmWriteOutcome<Code>, { ok: true }> | null = null;
    try {
      const result = await command();
      if (result.ok) {
        success = result;
      } else {
        failureCode = result.code;
      }
    } catch {
      failureCode = 'GENERIC';
    }
    if (success) {
      setPending(false);
      options.onClose();
      toast.success(success.toast.title, { description: success.toast.description });
      options.onSettled();
      return;
    }
    setPending(false);
    if (options.isStale(failureCode) || isUncertainOutcome(failureCode)) {
      options.onClose();
      toast.error(options.errorCopy(failureCode));
      options.onSettled();
      return;
    }
    setFailure(failureCode);
  }

  return {
    pending,
    failure,
    onOpenChange,
    run,
    /** Cho nút Back/đổi input xoá câu lỗi cũ mà không đụng vòng đời. */
    clearFailure: () => setFailure(null),
  };
}
