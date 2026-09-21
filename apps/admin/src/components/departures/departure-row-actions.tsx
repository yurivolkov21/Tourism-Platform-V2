'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { LockIcon, PencilIcon, UnlockIcon } from 'lucide-react';
import { useState } from 'react';
import { DepartureFormDialog } from '@/components/departures/departure-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { formatDateRange } from '@/lib/bookings-view';
import type { DepartureRowVM } from '@/lib/departures-view';
import {
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
  disabled,
  onSettled,
}: {
  row: DepartureRowVM;
  basePriceLabel: string;
  update: UpdateDepartureAction;
  setStatus: SetDepartureStatusAction;
  /** Đang kéo bảng tươi về — khoá mọi nút cho tới khi xong. */
  disabled: boolean;
  onSettled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);

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
        onClick={() => setEditing(true)}
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
        {nextStatus === 'CLOSED' ? t.setStatus.close : t.setStatus.reopen}
      </Button>

      {editing ? (
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
          liveBookingCount={row.liveBookingCount}
          seatsBooked={row.seatsBooked}
          basePriceLabel={basePriceLabel}
          isStale={isUpdateStale}
          errorCopy={updateErrorCopy}
          onSubmit={(values) => update({ id: row.id, ...values })}
          toast={(saved) => ({
            title: t.edit.toast.title,
            // Ngày đọc từ RESPONSE, không từ form đã gửi.
            description: t.edit.toast.body(formatDateRange(saved.startDate, saved.endDate)),
          })}
          onClose={() => setEditing(false)}
          onSettled={onSettled}
        />
      ) : null}

      {toggling ? (
        <ConfirmWriteDialog<SetStatusContractCode>
          copy={setStatusDialogCopy(nextStatus)}
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
    </div>
  );
}
