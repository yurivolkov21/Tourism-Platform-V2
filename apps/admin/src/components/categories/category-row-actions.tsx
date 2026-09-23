'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { StableLabel } from '@/components/kit/stable-label';
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
  onMoveStart,
  onSettled,
}: {
  row: CategoryRowVM;
  update: UpdateCategoryAction;
  setActive: SetCategoryActiveAction;
  move: MoveCategoryAction;
  /**
   * Bảng đang bận — kéo dữ liệu tươi về, HOẶC có một lượt đổi chỗ đang bay ở
   * một hàng BẤT KỲ. Khoá mọi nút cho tới khi xong.
   *
   * Cờ đổi-chỗ nằm ở cấp BẢNG chứ không phải state riêng của hàng này, và đó
   * là bản vá của vòng review F14: để nó ở cấp hàng thì trong lúc lệnh của
   * hàng 2 đang bay, mũi tên hàng 3 vẫn bấm được — hai lệnh chồng nhau trên
   * hai cặp giao nhau là đúng cuộc đua làm hai danh mục cùng `order`. Tức một
   * admin bấm nhanh là đủ, không cần hai người.
   */
  disabled: boolean;
  /** Bật cờ bận của bảng TRƯỚC khi gửi — xem JSDoc của `disabled`. */
  onMoveStart: () => void;
  onSettled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function runMove(direction: 'up' | 'down') {
    onMoveStart();
    try {
      const result = await move({ id: row.id, direction });
      // Mã TRẠNG-THÁI-CŨ ở đây luôn có nghĩa "danh sách đã đổi dưới chân bạn",
      // nên đường ra đúng là làm mới bảng — `onSettled` lo việc ấy.
      if (!result.ok) {
        toast.error(moveErrorCopy(result.code));
      }
    } finally {
      onSettled();
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t.move.upLabel(row.name)}
        disabled={disabled || !row.canMoveUp}
        onClick={() => void runMove('up')}
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t.move.downLabel(row.name)}
        disabled={disabled || !row.canMoveDown}
        onClick={() => void runMove('down')}
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>

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
        {/* Giữ chỗ cho nhãn rộng hơn trong cặp Hide/Show: hai nhãn rộng khác
            nhau, và cụm nút canh phải, nên hàng mang nhãn hẹp hơn từng kéo lệch
            mũi tên với nút Edit khỏi cột của hàng trên (lượt thử tay F14). */}
        <StableLabel
          label={row.isActive ? t.setActive.hide : t.setActive.show}
          reserve={[t.setActive.hide, t.setActive.show]}
        />
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
          // Câu của hộp này nói về điều KHÔNG xảy ra (tour vẫn bán, link vẫn
          // chạy) — tô đỏ là để màu nói ngược với chữ.
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
