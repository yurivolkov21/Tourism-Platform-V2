'use client';

import type { AdminDepartureSettableStatus } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button, buttonVariants } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { BanIcon, LockIcon, PencilIcon, UnlockIcon } from 'lucide-react';
import { useState } from 'react';
import { DepartureFormDialog } from '@/components/departures/departure-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { StableLabel } from '@/components/kit/stable-label';
import { formatDateRange } from '@/lib/bookings-view';
import type { DepartureRowVM } from '@/lib/departures-view';
import {
  type CancelContractCode,
  type CancelDepartureAction,
  cancelConfirmRows,
  cancelDialogCopy,
  cancelErrorCopy,
  isCancelStale,
  isSetStatusStale,
  isUpdateStale,
  type SetDepartureStatusAction,
  type SetStatusContractCode,
  setStatusConfirmRows,
  setStatusDialogCopy,
  setStatusErrorCopy,
  setStatusToast,
  type UpdateContractCode,
  type UpdateDepartureAction,
  updateErrorCopy,
} from '@/lib/departures-write';

/**
 * Ba hành động của MỘT hàng trong bảng chuyến: Sửa (dialog form, F12), Đóng/Mở
 * lại (dialog xác nhận của kit, F12) và Huỷ chuyến (F13 — chạm tiền, nên có
 * dialog riêng đòi lý do).
 *
 * Hàng `CANCELLED` KHÔNG có nút nào — chuyến đã huỷ là bản ghi đóng, khách của
 * nó đã được hoàn tiền. Nút Reopen của một chuyến quá hạn chót thì tắt: server
 * sẽ từ chối bằng `DEADLINE_PASSED`, nên mời bấm là mời ăn một câu lỗi.
 *
 * Từ F16 hàng `departed`/`completed` chỉ còn Sửa: nút đóng/mở và nút huỷ
 * nhường chỗ cho hai ô giữ chỗ cùng cỡ (spec F16 §2f). Việc ẩn nút đóng/mở là
 * luật của giao diện, không phải của server — xem JSDoc đầu `departures-view.ts`.
 *
 * Component KHÔNG tự import server action — nhận từ bảng, bảng nhận từ trang.
 * Test dựng với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.departures;

/**
 * Hai nhãn của nút đóng/mở. Nút thật và ô giữ chỗ của nó dùng CHUNG danh sách
 * này làm `reserve` của `StableLabel`, để hai bên luôn rộng bằng nhau.
 */
const TOGGLE_LABELS = [t.setStatus.close, t.setStatus.reopen];

export function DepartureRowActions({
  row,
  basePriceLabel,
  update,
  setStatus,
  cancel,
  disabled,
  onSettled,
}: {
  row: DepartureRowVM;
  basePriceLabel: string;
  update: UpdateDepartureAction;
  setStatus: SetDepartureStatusAction;
  cancel: CancelDepartureAction;
  /** Đang kéo bảng tươi về — khoá mọi nút cho tới khi xong. */
  disabled: boolean;
  onSettled: () => void;
}) {
  /**
   * Mở form sửa = CHỤP phiên bản hàng tại đúng lúc bấm, không đọc lại
   * `row.version` lúc gửi. Bảng có thể được vẽ lại dưới chân dialog (một
   * `router.refresh()`), và nếu lúc ấy version mới trôi vào payload thì token
   * chống-ghi-đè-mù tự vô hiệu hoá chính nó: server so hai giá trị bằng nhau
   * rồi cho ghi đè thứ người dùng chưa hề nhìn thấy. `initial` đã được đóng
   * băng theo cách tương tự (`useState` trong dialog) — đây là nửa còn lại.
   */
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  /**
   * Hộp đóng/mở đang mở cho CHIỀU nào — chụp lúc bấm, cùng lý do với
   * `editingVersion`: bảng có thể refresh dưới chân hộp (admin khác vừa đóng
   * chuyến), và đọc lại chiều từ hàng mới là đổi chữ trong hộp ngay dưới ngón
   * tay người dùng, rồi gửi lệnh ngược với lệnh họ đã chọn.
   */
  const [toggling, setToggling] = useState<AdminDepartureSettableStatus | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Chuyến đã huỷ: không sửa, không đóng, không mở — bảng chỉ còn là bản ghi.
  if (!row.canEdit) return null;

  const toggle = row.toggle;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t.edit.actionLabel(row.dates)}
        disabled={disabled}
        onClick={() => setEditingVersion(row.version)}
      >
        <PencilIcon data-icon="inline-start" aria-hidden="true" />
        {t.edit.action}
      </Button>

      {toggle ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={
            toggle.next === 'CLOSED'
              ? t.setStatus.closeLabel(row.dates)
              : t.setStatus.reopenLabel(row.dates)
          }
          // Mở lại sau hạn chót là điều server từ chối — nút tắt, và cột "Book/
          // cancel by" ngay bên cạnh đã nói vì sao.
          disabled={disabled || !toggle.enabled}
          onClick={() => setToggling(toggle.next)}
        >
          {toggle.next === 'CLOSED' ? (
            <LockIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <UnlockIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {/* Giữ chỗ cho nhãn rộng hơn trong cặp Close/Reopen — xem `StableLabel`. */}
          <StableLabel
            label={toggle.next === 'CLOSED' ? t.setStatus.close : t.setStatus.reopen}
            reserve={TOGGLE_LABELS}
          />
        </Button>
      ) : (
        // Ô GIỮ CHỖ cùng cỡ nút đóng/mở, cho chuyến đã khởi hành (spec F16
        // §2f): thiếu hẳn nút giữa thì cụm canh phải dồn Sửa lệch khỏi cột của
        // hàng trên. `span` mượn lớp của nút chứ không phải `Button` bị ẩn —
        // cùng lý do với ô giữ chỗ nút huỷ bên dưới. Cùng `TOGGLE_LABELS` với
        // nút thật để bề rộng trùng khít.
        <span
          aria-hidden="true"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'invisible')}
        >
          <LockIcon data-icon="inline-start" />
          <StableLabel label={t.setStatus.close} reserve={TOGGLE_LABELS} />
        </span>
      )}

      {row.canCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t.cancel.actionLabel(row.dates)}
          disabled={disabled}
          onClick={() => setCancelling(true)}
        >
          <BanIcon data-icon="inline-start" aria-hidden="true" />
          {t.cancel.action}
        </Button>
      ) : (
        // Ô GIỮ CHỖ cùng cỡ nút huỷ, cho hàng không còn huỷ được (đã khởi
        // hành). Thiếu hẳn nút cuối thì cụm canh phải dồn nút Sửa lệch khỏi
        // cột của hàng trên (lượt thử tay F14, 23/09) — từ F16 hàng ấy cũng
        // không còn nút đóng/mở, nên Sửa là nút duy nhất phải giữ cột.
        //
        // Là một `span` mượn đúng lớp của nút chứ không phải một `Button` bị
        // ẩn: ẩn đi rồi thì nó vẫn là một nút trong DOM, và chỉ cần quên một
        // thuộc tính là trình đọc màn hình mời bấm một thứ không tồn tại.
        <span
          aria-hidden="true"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'invisible')}
        >
          <BanIcon data-icon="inline-start" />
          {t.cancel.action}
        </span>
      )}

      {editingVersion !== null ? (
        <DepartureFormDialog<UpdateContractCode>
          copy={t.edit.dialog}
          formId={`departure-edit-${row.id}`}
          initial={{
            startDate: row.startDate,
            endDate: row.endDate,
            seats: String(row.seatsTotal),
            // Ô giá TRỐNG khi chuyến đang thừa hưởng `basePrice` — điền sẵn
            // giá tour vào đây là để một cú bấm Save đóng đinh nó vào chuyến.
            price: row.priceOverride ?? '',
          }}
          seatsBooked={row.seatsBooked}
          basePriceLabel={basePriceLabel}
          isStale={isUpdateStale}
          errorCopy={updateErrorCopy}
          onSubmit={(values) => update({ id: row.id, version: editingVersion, ...values })}
          toast={(saved) => ({
            title: t.edit.toast.title,
            // Ngày đọc từ RESPONSE, không từ form đã gửi.
            description: t.edit.toast.body(formatDateRange(saved.startDate, saved.endDate)),
          })}
          onClose={() => setEditingVersion(null)}
          onSettled={onSettled}
        />
      ) : null}

      {toggling !== null ? (
        <ConfirmWriteDialog<SetStatusContractCode>
          copy={setStatusDialogCopy(toggling, row.pendingBookingCount)}
          rows={setStatusConfirmRows(row)}
          submitVariant={toggling === 'CLOSED' ? 'destructive' : 'default'}
          onSubmit={async () => {
            const result = await setStatus({ id: row.id, status: toggling });
            if (!result.ok) return { ok: false, code: result.code };
            return { ok: true, toast: setStatusToast(result.row, row.dates) };
          }}
          isStale={isSetStatusStale}
          errorCopy={setStatusErrorCopy}
          onClose={() => setToggling(null)}
          onSettled={onSettled}
        />
      ) : null}

      {cancelling ? (
        <ConfirmWriteDialog<CancelContractCode>
          copy={cancelDialogCopy()}
          noteId={`departure-cancel-${row.id}`}
          noteRequired={t.cancel.dialog.noteRequired}
          rows={cancelConfirmRows(row)}
          submitVariant="destructive"
          onSubmit={async (reason) => {
            const result = await cancel({ id: row.id, reason });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: {
                title: t.cancel.toast.title,
                // Ngày đọc từ RESPONSE, không từ hàng đang hiển thị.
                description: t.cancel.toast.body(
                  formatDateRange(result.row.startDate, result.row.endDate),
                ),
              },
            };
          }}
          isStale={isCancelStale}
          errorCopy={cancelErrorCopy}
          onClose={() => setCancelling(false)}
          onSettled={onSettled}
        />
      ) : null}
    </div>
  );
}
