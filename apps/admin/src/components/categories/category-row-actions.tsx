'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { CategoryRowVM } from '@/lib/categories-view';
import {
  categoryUpdatePayload,
  isSetActiveStale,
  isUpdateStale,
  type MoveCategoryAction,
  moveErrorCopy,
  type SetActiveContractCode,
  type SetCategoryActiveAction,
  setActiveConfirmRows,
  setActiveDialogCopy,
  setActiveErrorCopy,
  setActiveToast,
  type UpdateCategoryAction,
  type UpdateContractCode,
  updateErrorCopy,
} from '@/lib/categories-write';

/**
 * Bốn hành động của MỘT hàng bảng danh mục (spec P4e-2 F14): Sửa · Ẩn/Hiện ·
 * Lên · Xuống.
 *
 * KHÔNG có nút xoá, và đó là quyết định của cả phase: `is_active` đã có sẵn nên
 * ẩn là đảo ngược được bằng một cú bấm, còn xoá thì không (spec §2a).
 *
 * Hai nút mũi tên tắt ở hai biên theo `canMoveUp`/`canMoveDown` — bản soi
 * gương của `CANNOT_MOVE` phía server. Gương chứ không phải nguồn: server vẫn
 * từ chối thật; đây chỉ để nút không mời admin bấm một thứ chắc chắn ăn 409.
 *
 * Component KHÔNG tự import server action — nhận từ bảng, bảng nhận từ trang.
 * Test dựng với hàm giả, không mock `next/headers`.
 */
const t = messages.admin.categories;

export function CategoryRowActions({
  row,
  update,
  setActive,
  move,
  disabled,
  onSettled,
}: {
  row: CategoryRowVM;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
  /** Đang kéo bảng tươi về — khoá mọi nút cho tới khi xong. */
  disabled: boolean;
  onSettled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  /** Một lượt đổi chỗ đang bay — khoá cả hai mũi tên để không bấm chồng. */
  const [moving, setMoving] = useState(false);

  async function runMove(direction: 'up' | 'down') {
    setMoving(true);
    try {
      const result = await move({ id: row.id, direction });
      // Mã TRẠNG-THÁI-CŨ ở đây luôn có nghĩa "danh sách đã đổi dưới chân bạn",
      // nên đường ra đúng là làm mới bảng — `onSettled` lo việc ấy.
      if (!result.ok) {
        const { toast } = await import('sonner');
        toast.error(moveErrorCopy(result.code));
      }
    } finally {
      setMoving(false);
      onSettled();
    }
  }

  const busy = disabled || moving;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t.move.upLabel(row.name)}
        disabled={busy || !row.canMoveUp}
        onClick={() => void runMove('up')}
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t.move.downLabel(row.name)}
        disabled={busy || !row.canMoveDown}
        onClick={() => void runMove('down')}
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t.edit.actionLabel(row.name)}
        disabled={busy}
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
        disabled={busy}
        onClick={() => setToggling(true)}
      >
        {row.isActive ? (
          <EyeOffIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <EyeIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {row.isActive ? t.setActive.hide : t.setActive.show}
      </Button>

      {editing ? (
        <CategoryFormDialog<UpdateContractCode>
          copy={t.edit.dialog}
          mode="edit"
          formId={`category-edit-${row.id}`}
          initial={{
            name: row.name,
            // Chở theo cho đủ hình dạng; form sửa không render ô này.
            slug: row.slug,
            description: row.descriptionValue,
          }}
          isStale={isUpdateStale}
          errorCopy={updateErrorCopy}
          onSubmit={(values) => update(categoryUpdatePayload(row.id, values))}
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
          submitVariant={row.isActive ? 'destructive' : 'default'}
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
