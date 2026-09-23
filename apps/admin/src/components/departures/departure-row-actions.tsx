'use client';

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
 * Hai hành động của MỘT hàng trong bảng chuyến (spec P4e-1 F12): Sửa (dialog
 * form) và Đóng/Mở lại (dialog xác nhận của kit).
 *
 * Hàng `CANCELLED` KHÔNG có nút nào — chuyến đã huỷ là bản ghi đóng, khách của
 * nó đã được hoàn tiền. Nút Reopen của một chuyến quá hạn chót cũng tắt: server
 * sẽ từ chối bằng `DEADLINE_PASSED`, nên mời bấm là mời ăn một câu lỗi.
 *
 * KHÔNG có nút huỷ chuyến ở đây: đó là F13, và nó chạm tiền.
 *
 * Component KHÔNG tự import server action — nhận từ bảng, bảng nhận từ trang.
 * Test dựng với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.departures;

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
  const [toggling, setToggling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Chuyến đã huỷ: không sửa, không đóng, không mở — bảng chỉ còn là bản ghi.
  if (!row.canEdit) return null;

  const nextStatus = row.status === 'OPEN' ? 'CLOSED' : 'OPEN';
  const toggleEnabled = row.status === 'OPEN' ? row.canClose : row.canReopen;

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

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={
          nextStatus === 'CLOSED'
            ? t.setStatus.closeLabel(row.dates)
            : t.setStatus.reopenLabel(row.dates)
        }
        // Mở lại sau hạn chót là điều server từ chối — nút tắt, và cột "Book/
        // cancel by" ngay bên cạnh đã nói vì sao.
        disabled={disabled || !toggleEnabled}
        onClick={() => setToggling(true)}
      >
        {nextStatus === 'CLOSED' ? (
          <LockIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <UnlockIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {/* Giữ chỗ cho nhãn rộng hơn trong cặp Close/Reopen — xem `StableLabel`. */}
        <StableLabel
          label={nextStatus === 'CLOSED' ? t.setStatus.close : t.setStatus.reopen}
          reserve={[t.setStatus.close, t.setStatus.reopen]}
        />
      </Button>

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
        // hành). Thiếu hẳn nút cuối thì cụm canh phải dồn Sửa và Đóng lệch khỏi
        // cột của hàng trên (lượt thử tay F14, 23/09).
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

      {toggling ? (
        <ConfirmWriteDialog<SetStatusContractCode>
          copy={setStatusDialogCopy(nextStatus, row.pendingBookingCount)}
          rows={setStatusConfirmRows(row)}
          submitVariant={nextStatus === 'CLOSED' ? 'destructive' : 'default'}
          onSubmit={async () => {
            const result = await setStatus({ id: row.id, status: nextStatus });
            if (!result.ok) return { ok: false, code: result.code };
            return { ok: true, toast: setStatusToast(result.row, row.dates) };
          }}
          isStale={isSetStatusStale}
          errorCopy={setStatusErrorCopy}
          onClose={() => setToggling(false)}
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
