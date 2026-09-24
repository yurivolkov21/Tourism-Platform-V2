'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { EyeIcon, EyeOffIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { DestinationFormDialog } from '@/components/destinations/destination-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { StableLabel } from '@/components/kit/stable-label';
import type { DestinationRowVM } from '@/lib/destinations-view';
import {
  destinationEditValues,
  destinationUpdatePayload,
  hideConsequences,
  isSetActiveStale,
  isUpdateStale,
  type SetActiveContractCode,
  type SetDestinationActiveAction,
  setActiveConfirmRows,
  setActiveDialogCopy,
  setActiveErrorCopy,
  setActiveToast,
  type UpdateContractCode,
  type UpdateDestinationAction,
  updateErrorCopy,
} from '@/lib/destinations-write';

/**
 * Hai hành động của MỘT hàng bảng điểm đến (spec P4e-2 F15): Sửa · Ẩn/Hiện.
 *
 * KHÔNG có nút xoá (spec §2a — khoá ngoại `tour_destinations` khai `ON DELETE
 * CASCADE`, một lệnh xoá sẽ âm thầm gỡ điểm đến khỏi mọi tour), và KHÔNG có
 * mũi tên: bảng này không có thứ tự nào để sắp.
 *
 * Hộp xác nhận ẨN nói đủ những gì bảng đo spec §4.6 tìm ra — cả hai hệ quả
 * không hiển nhiên ở trang vùng lẫn hộ chiếu của khách — rồi mới trấn an bằng
 * câu cảnh báo giọng trung tính.
 *
 * Component KHÔNG tự import server action — nhận từ bảng, bảng nhận từ trang.
 */
const t = messages.admin.destinations;

export function DestinationRowActions({
  row,
  update,
  setActive,
  disabled,
  onSettled,
}: {
  row: DestinationRowVM;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
  /** Bảng đang kéo dữ liệu tươi về — khoá mọi nút cho tới khi xong. */
  disabled: boolean;
  onSettled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t.edit.actionLabel(row.name)}
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
          row.isActive ? t.setActive.hideLabel(row.name) : t.setActive.showLabel(row.name)
        }
        disabled={disabled}
        onClick={() => setToggling(true)}
      >
        {row.isActive ? (
          <EyeOffIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <EyeIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {/* Giữ chỗ cho nhãn rộng hơn trong cặp Hide/Show (bài học 13): cụm nút
            canh phải, nên hàng mang nhãn hẹp hơn kéo nút Edit lệch cột. */}
        <StableLabel
          label={row.isActive ? t.setActive.hide : t.setActive.show}
          reserve={[t.setActive.hide, t.setActive.show]}
        />
      </Button>

      {editing ? (
        <DestinationFormDialog<UpdateContractCode>
          copy={t.edit.dialog}
          mode="edit"
          formId={`destination-edit-${row.id}`}
          initial={destinationEditValues(row)}
          isStale={isUpdateStale}
          errorCopy={updateErrorCopy}
          onSubmit={(values) => update(destinationUpdatePayload(row.id, values))}
          toast={(saved) => ({
            title: t.edit.toast.title,
            // Tên đọc từ RESPONSE, không từ form đã gửi.
            description: t.edit.toast.body(saved.name),
          })}
          onClose={() => setEditing(false)}
          onSettled={onSettled}
        />
      ) : null}

      {toggling ? (
        <ConfirmWriteDialog<SetActiveContractCode>
          copy={setActiveDialogCopy(!row.isActive)}
          rows={setActiveConfirmRows(row)}
          extra={
            row.isActive ? (
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {hideConsequences(row).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : undefined
          }
          submitVariant={row.isActive ? 'destructive' : 'default'}
          // Câu cảnh báo của cả hai chiều nói điều KHÔNG xảy ra (tour vẫn bán,
          // link vẫn chạy) — tô đỏ là để màu nói ngược với chữ (bài học 14).
          warningTone="neutral"
          onSubmit={async () => {
            const result = await setActive({ id: row.id, isActive: !row.isActive });
            if (!result.ok) return { ok: false, code: result.code };
            return { ok: true, toast: setActiveToast(result.row) };
          }}
          isStale={isSetActiveStale}
          errorCopy={setActiveErrorCopy}
          onClose={() => setToggling(false)}
          onSettled={onSettled}
        />
      ) : null}
    </div>
  );
}
