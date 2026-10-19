'use client';

import { messages } from '@tourism/i18n';
import { Button, buttonVariants } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { EyeIcon, EyeOffIcon, ImagesIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { useState } from 'react';
import { useCanAccess } from '@/components/admin-access-provider';
import { DestinationFormDialog } from '@/components/destinations/destination-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { DeleteRowAction } from '@/components/kit/delete-row-action';
import { StableLabel } from '@/components/kit/stable-label';
import type { DestinationRowVM } from '@/lib/destinations-view';
import {
  type DeleteContractCode,
  type DeleteDestinationAction,
  deleteBlockedReason,
  deleteConfirmRows,
  deleteDialogCopy,
  deleteErrorCopy,
  deleteToast,
  destinationEditValues,
  destinationUpdatePayload,
  hideConsequences,
  isDeleteStale,
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
 * Các hành động của MỘT hàng bảng điểm đến: Sửa · Ảnh (link tới trang Photos, ADR-0060 §8) ·
 * Ẩn/Hiện (spec P4e-2 F15) và Xoá (ADR-0053). KHÔNG có mũi tên: bảng này không có thứ tự nào để
 * sắp.
 *
 * Delete bật khi 0 tour — ADR-0053, thay quyết định "không có nút xoá" của spec P4e-2
 * §2a. Đếm tour MỌI trạng thái (`linkedTourCount`); còn tour thì nút khoá và tooltip
 * gợi ý ẩn: ẩn đảo ngược được bằng một cú bấm, còn xoá thì không. Hàng đã ẩn thì tooltip
 * và câu `IN_USE` chỉ nói lý do, không khuyên ẩn (Ruling F-b). Server vẫn là phán
 * quyết cuối — bảng có thể cũ hơn DB, và `IN_USE` khi ấy đóng hộp rồi làm mới. Chốt
 * chặn thật là phép đếm liên kết dưới khoá hàng ở API (ADR-0053 §3), không phải nút này;
 * khoá ngoại `tour_destinations` là `ON DELETE RESTRICT` từ AMEND 2 (G25), lưới cuối cho
 * các đường xoá ngoài API.
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
  remove,
  disabled,
  focusAfterDelete,
  onSettled,
}: {
  row: DestinationRowVM;
  update: UpdateDestinationAction;
  setActive: SetDestinationActiveAction;
  /** Lệnh xoá (ADR-0053) — trang chở xuống. */
  remove: DeleteDestinationAction;
  /** Đích focus sau khi xoá được hàng này — nút Add của bảng (review A2-1). */
  focusAfterDelete: React.RefObject<HTMLElement | null>;
  /** Bảng đang kéo dữ liệu tươi về — khoá mọi nút cho tới khi xong. */
  disabled: boolean;
  onSettled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  // Xoá là thủ tục chỉ Owner (ADR-0052 §7 và ADR-0053): Staff không có nút, cũng không chỗ
  // trống — không hàng nào của Staff có nút ấy, nên cụm nút vẫn thẳng cột.
  const mayDelete = useCanAccess('destinations.delete');

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t.edit.actionLabel(row.name)}
        disabled={disabled}
        // Khoá mà vẫn nhận focus (`aria-disabled` thay thuộc tính `disabled`):
        // hộp thoại đóng đúng lúc bảng làm mới, và Base UI trả focus về nút đã mở
        // nó — nút `disabled` thật thì focus rơi về <body> (vòng review F15).
        focusableWhenDisabled
        onClick={() => setEditing(true)}
      >
        <PencilIcon data-icon="inline-start" aria-hidden="true" />
        {t.edit.action}
      </Button>

      {/* Link chứ không phải nút: mở trang riêng, mở tab mới được. Không khoá theo `disabled`
          — bảng đang làm mới không đổi gì ở trang ảnh. */}
      <Link
        href={`/destinations/${row.slug}/photos`}
        aria-label={t.photos.actionLabel(row.name)}
        // `cn` gộp lớp như `Button` làm: `buttonVariants` trần giữ cả `border-transparent` gốc
        // lẫn `border-border` của outline, và viền trong suốt thắng — link mất viền (đo Chromium).
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        <ImagesIcon data-icon="inline-start" aria-hidden="true" />
        {t.photos.action}
      </Link>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={
          row.isActive ? t.setActive.hideLabel(row.name) : t.setActive.showLabel(row.name)
        }
        disabled={disabled}
        focusableWhenDisabled
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

      {mayDelete ? (
        <DeleteRowAction<DeleteContractCode>
          label={t.delete.action}
          actionLabel={t.delete.actionLabel(row.name)}
          blockedReason={deleteBlockedReason(row)}
          disabled={disabled}
          dialog={{
            copy: deleteDialogCopy(),
            rows: deleteConfirmRows(row),
            isStale: isDeleteStale,
            // Câu `IN_USE` theo trạng thái hiện/ẩn của hàng (Ruling F-b).
            errorCopy: (code) => deleteErrorCopy(code, row),
            onSubmit: async () => {
              const result = await remove({ id: row.id });
              if (!result.ok) return { ok: false, code: result.code };
              // Response chỉ chở slug (hàng đã mất), nên tên lấy từ hàng đang hiện.
              return { ok: true, toast: deleteToast(row.name) };
            },
          }}
          focusAfterDelete={focusAfterDelete}
          onSettled={onSettled}
        />
      ) : null}

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
          copy={setActiveDialogCopy(!row.isActive, row)}
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
