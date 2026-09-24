'use client';

import {
  DESTINATION_DESCRIPTION_MAX,
  DESTINATION_SLUG_MAX,
  REGIONS,
  slugifyVietnamese,
} from '@tourism/contract';
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
import { Textarea } from '@tourism/ui/components/textarea';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import type { TransportFailureCode } from '@/lib/api/write-error';
import {
  type DestinationFormErrors,
  type DestinationFormValues,
  type DestinationWriteResult,
  validateDestinationForm,
} from '@/lib/destinations-write';
import { hasFormErrors } from '@/lib/form-errors';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Form THÊM và SỬA một điểm đến (spec P4e-2 F15) — một component cho cả hai
 * chiều, cùng khuôn `CategoryFormDialog`: vòng đời lệnh ghi là của kit qua
 * `useConfirmWrite`, mỗi ô là một `FormField` của kit.
 *
 * Ô SLUG chỉ render ở chiều TẠO — không phải disabled mà là KHÔNG CÓ (spec
 * §2c). Lúc tạo nó điền sẵn bằng `slugifyVietnamese(name, 80)` và thôi tự điền
 * ngay khi admin chạm vào nó: slug thật do người chọn (`Hà Nội` → `hanoi`).
 *
 * Ô VÙNG là một danh sách chọn ba mục đọc thẳng từ `REGIONS` của contract,
 * không phải ô chữ (spec §2b, ADR-0045): cột DB là chữ tự do mà web ghép với
 * ba vùng cố định, nên một lần gõ nhầm là điểm đến biến khỏi mọi trang vùng.
 * Từ lượt thử tay F15 (24/09) nó là `FormSelect` của kit — cùng dáng dropdown
 * với mọi ô chọn khác của back office — thay cho `<select>` gốc mà user thấy thô.
 */
const t = messages.admin.destinations;

/** Ba vùng của contract, nhãn là chính tên vùng — thứ tự Bắc, Trung, Nam. */
const REGION_OPTIONS = REGIONS.map((region) => ({ value: region.name, label: region.name }));

export interface DestinationFormDialogProps<Code extends string> {
  copy: { title: string; body: string; submit: string; submitting: string };
  /** Chiều đang mở. Quyết định ô slug có mặt hay không, và luật validate nào áp. */
  mode: 'create' | 'edit';
  initial: DestinationFormValues;
  /** `id` riêng cho mỗi dialog: nhiều hàng cùng DOM, label phải trỏ đúng ô. */
  formId: string;
  isStale: (code: Code | TransportFailureCode) => boolean;
  errorCopy: (code: Code | TransportFailureCode) => string;
  onSubmit: (values: DestinationFormValues) => Promise<DestinationWriteResult<Code>>;
  /** Toast của nhánh thành công — vùng dựng, vì chỉ vùng biết server vừa làm gì. */
  toast: (row: Extract<DestinationWriteResult<Code>, { ok: true }>['row']) => {
    title: string;
    description: string;
  };
  onClose: () => void;
  /** Gọi sau mọi kết cục đã chạm server — cha refresh + khoá nút. */
  onSettled: () => void;
}

export function DestinationFormDialog<Code extends string>({
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
}: DestinationFormDialogProps<Code>) {
  const [values, setValues] = useState<DestinationFormValues>(initial);
  /** Admin đã tự gõ ô slug chưa — gõ rồi thì tên thôi ghi đè nó. */
  const [slugTouched, setSlugTouched] = useState(false);
  /** Chỉ mắng SAU lần bấm gửi đầu tiên; lỗi là DERIVED nên sửa xong là câu lỗi tự biến. */
  const [showValidation, setShowValidation] = useState(false);

  const errors: DestinationFormErrors = showValidation ? validateDestinationForm(values, mode) : {};

  const { pending, failure, onOpenChange, run, clearFailure } = useConfirmWrite<Code>({
    isStale,
    errorCopy,
    onClose,
    onSettled,
  });

  function patch(next: Partial<DestinationFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function patchName(name: string) {
    // Slug chạy theo tên tới khi admin chạm vào nó — và chỉ ở chiều TẠO.
    const nextSlug =
      mode === 'create' && !slugTouched
        ? slugifyVietnamese(name, DESTINATION_SLUG_MAX)
        : values.slug;
    patch({ name, slug: nextSlug });
  }

  function submit() {
    setShowValidation(true);
    // Ô hỏng thì KHÔNG bắn. Chặn ở đây chứ không disable nút — một nút mờ
    // không nói vì sao nó mờ.
    if (hasFormErrors(validateDestinationForm(values, mode))) return;
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
            <FormField id={`${formId}-name`} label={t.form.name} error={errors.name}>
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
            </FormField>

            {mode === 'create' ? (
              <FormField
                id={`${formId}-slug`}
                label={t.form.slug}
                hint={t.form.slugHint}
                error={errors.slug}
              >
                {(describedBy) => (
                  <Input
                    id={`${formId}-slug`}
                    value={values.slug}
                    // Ba thuộc tính của ô slug danh mục (lượt thử tay F14), dùng
                    // lại nguyên: slug không phải câu văn — soát chính tả gạch đỏ
                    // nó, còn tự viết hoa hay tự sửa chữ trên điện thoại làm hỏng nó.
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    disabled={pending}
                    aria-invalid={errors.slug !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                      setSlugTouched(true);
                      patch({ slug: event.target.value });
                    }}
                  />
                )}
              </FormField>
            ) : null}

            <FormField
              id={`${formId}-region`}
              label={t.form.region}
              hint={t.form.regionHint}
              error={errors.region}
            >
              {(describedBy) => (
                // Giá trị rỗng (form tạo mới, hoặc chuỗi cũ trong DB không khớp vùng
                // nào) hiện câu giữ chỗ; danh sách không có mục "chưa có vùng" nên
                // không ai chọn lại được trạng thái ấy.
                <FormSelect
                  id={`${formId}-region`}
                  value={values.region}
                  options={REGION_OPTIONS}
                  placeholder={t.form.regionPlaceholder}
                  disabled={pending}
                  invalid={errors.region !== undefined}
                  describedBy={describedBy}
                  onValueChange={(region) => patch({ region })}
                />
              )}
            </FormField>

            <FormField id={`${formId}-country`} label={t.form.country} error={errors.country}>
              {(describedBy) => (
                <Input
                  id={`${formId}-country`}
                  value={values.country}
                  disabled={pending}
                  aria-invalid={errors.country !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ country: event.target.value })}
                />
              )}
            </FormField>

            <FormField
              id={`${formId}-description`}
              label={t.form.description}
              hint={t.form.descriptionHint(DESTINATION_DESCRIPTION_MAX)}
              error={errors.description}
            >
              {(describedBy) => (
                <Textarea
                  id={`${formId}-description`}
                  rows={4}
                  value={values.description}
                  disabled={pending}
                  aria-invalid={errors.description !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              )}
            </FormField>
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
