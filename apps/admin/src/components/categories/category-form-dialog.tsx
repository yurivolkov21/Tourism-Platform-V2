'use client';

import { CATEGORY_DESCRIPTION_MAX, CATEGORY_SLUG_MAX, slugifyVietnamese } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import type * as React from 'react';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import type { TransportFailureCode } from '@/lib/api/write-error';
import {
  type CategoryFormErrors,
  type CategoryFormValues,
  type CategoryWriteResult,
  hasFormErrors,
  validateCategoryForm,
} from '@/lib/categories-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Form THÊM và SỬA một danh mục (spec P4e-2 F14) — một component cho cả hai
 * chiều, cùng lý lẽ `DepartureFormDialog`: hai component song sinh là hai chỗ
 * phải nhớ sửa khi thêm một ô.
 *
 * Ô SLUG chỉ render ở chiều TẠO. Không phải disabled mà là KHÔNG CÓ: một ô mờ
 * mời người ta thử rồi bắt ta giải thích, còn vắng mặt thì câu chuyện đã xong.
 * Lý do nó khoá nằm ở spec §2c — slug đi vào `/tours?categories=<slug>`, mà
 * tham số truy vấn thì không chuyển hướng được.
 *
 * VÒNG ĐỜI lệnh ghi là của kit, qua hook `useConfirmWrite` — đúng tiền lệ
 * `DepartureFormDialog`, không chép máy lần thứ ba.
 */
const t = messages.admin.categories;

export interface CategoryFormDialogProps<Code extends string> {
  copy: { title: string; body: string; submit: string; submitting: string };
  /** Chiều đang mở. Quyết định ô slug có mặt hay không, và luật validate nào áp. */
  mode: 'create' | 'edit';
  initial: CategoryFormValues;
  /** `id` riêng cho mỗi dialog: nhiều hàng cùng DOM, label phải trỏ đúng ô. */
  formId: string;
  isStale: (code: Code | TransportFailureCode) => boolean;
  errorCopy: (code: Code | TransportFailureCode) => string;
  onSubmit: (values: CategoryFormValues) => Promise<CategoryWriteResult<Code>>;
  /** Toast của nhánh thành công — vùng dựng, vì chỉ vùng biết server vừa làm gì. */
  toast: (row: Extract<CategoryWriteResult<Code>, { ok: true }>['row']) => {
    title: string;
    description: string;
  };
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}

export function CategoryFormDialog<Code extends string>({
  copy,
  mode,
  initial,
  formId,
  isStale,
  errorCopy,
  onSubmit,
  toast,
  onClose,
  onSettled,
}: CategoryFormDialogProps<Code>) {
  const [values, setValues] = useState<CategoryFormValues>(initial);
  /**
   * Admin đã tự gõ ô slug chưa.
   *
   * Tự điền slug theo tên là tiện; GHI ĐÈ thứ người ta vừa cố ý gõ là cướp
   * quyền. Đo trên production: slug thật do người chọn (`Hà Nội` → `hanoi`,
   * không phải `ha-noi`), nên quyền quyết cuối phải ở họ.
   */
  const [slugTouched, setSlugTouched] = useState(false);
  /** Chỉ mắng SAU lần bấm gửi đầu tiên; lỗi là DERIVED nên gõ sửa xong là câu lỗi tự biến. */
  const [showValidation, setShowValidation] = useState(false);

  const errors: CategoryFormErrors = showValidation ? validateCategoryForm(values, mode) : {};

  const { pending, failure, onOpenChange, run, clearFailure } = useConfirmWrite<Code>({
    isStale,
    errorCopy,
    onClose,
    onSettled,
  });

  function patch(next: Partial<CategoryFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function patchName(name: string) {
    // Slug chạy theo tên tới khi admin chạm vào nó — và chỉ ở chiều TẠO, vì
    // chiều sửa không có ô ấy để mà chạy theo.
    const nextSlug =
      mode === 'create' && !slugTouched ? slugifyVietnamese(name, CATEGORY_SLUG_MAX) : values.slug;
    patch({ name, slug: nextSlug });
  }

  function submit() {
    setShowValidation(true);
    // Ô hỏng thì KHÔNG bắn. Chặn ở đây chứ không disable nút — một nút mờ
    // không nói vì sao nó mờ.
    if (hasFormErrors(validateCategoryForm(values, mode))) return;
    void run(async () => {
      const result = await onSubmit(values);
      if (!result.ok) return { ok: false, code: result.code };
      return { ok: true, toast: toast(result.row) };
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-md')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4">
            <Field id={`${formId}-name`} label={t.form.name} error={errors.name}>
              {(describedBy) => (
                <Input
                  id={`${formId}-name`}
                  value={values.name}
                  disabled={pending}
                  aria-invalid={errors.name !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patchName(event.target.value)}
                />
              )}
            </Field>

            {mode === 'create' ? (
              <Field
                id={`${formId}-slug`}
                label={t.form.slug}
                hint={t.form.slugHint}
                error={errors.slug}
              >
                {(describedBy) => (
                  <Input
                    id={`${formId}-slug`}
                    value={values.slug}
                    disabled={pending}
                    aria-invalid={errors.slug !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                      setSlugTouched(true);
                      patch({ slug: event.target.value });
                    }}
                  />
                )}
              </Field>
            ) : null}

            <Field
              id={`${formId}-description`}
              label={t.form.description}
              hint={t.form.descriptionHint(CATEGORY_DESCRIPTION_MAX)}
              error={errors.description}
            >
              {(describedBy) => (
                <Textarea
                  id={`${formId}-description`}
                  rows={3}
                  value={values.description}
                  disabled={pending}
                  aria-invalid={errors.description !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              )}
            </Field>
          </div>

          {failure ? (
            <p role="alert" className="mt-4 text-sm text-destructive-emphasis">
              {errorCopy(failure)}
            </p>
          ) : null}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t.form.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Một ô: nhãn · control · (gợi ý) · (lỗi). Cùng khuôn `Field` của
 * `DepartureFormDialog`, gồm cả render-prop `describedBy` — gợi ý và câu lỗi
 * chỉ hữu ích nếu trình đọc màn hình đọc chúng CÙNG ô nhập.
 */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((value): value is string => value !== null)
    .join(' ');
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(describedBy === '' ? undefined : describedBy)}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive-emphasis">
          {error}
        </p>
      ) : null}
    </div>
  );
}
