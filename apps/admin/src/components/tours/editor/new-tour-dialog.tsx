'use client';

import { slugifyVietnamese, TOUR_SLUG_MAX } from '@tourism/contract';
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
import { cn } from '@tourism/ui/lib/utils';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type RefObject, useRef, useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { Picker } from '@/components/kit/picker';
import type { TourEditorOptions } from '@/lib/api/tours';
import { catalogOption } from '@/lib/catalog-option';
import { hasFormErrors } from '@/lib/form-errors';
import { useCreateRequest } from '@/lib/quick-create';
import { tourStepHref } from '@/lib/tour-editor-view';
import {
  type CreateTourAction,
  type CreateTourContractCode,
  clearDeletedCreateChoices,
  createTourErrorCopy,
  newTourFormValues,
  type TourCreateFormErrors,
  type TourCreateFormValues,
  tourCreatePayload,
  validateTourCreateForm,
} from '@/lib/tour-editor-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Hộp New tour ở trang Tours (spec F17 §2a) — cùng khuôn `DestinationFormDialog`:
 * vòng đời lệnh ghi là của kit qua `useConfirmWrite`, mỗi ô là một `FormField`,
 * mọi ô chọn là `Picker` của kit (bài học 12).
 *
 * - Slug chạy theo tên bằng `slugifyVietnamese(title, 120)` tới khi admin chạm
 *   vào ô slug; ô ấy tắt soát chính tả, tự viết hoa, tự sửa chữ.
 * - `SLUG_TAKEN` là lỗi của Ô SLUG: hiện dưới ô ấy, hộp vẫn mở, chữ còn nguyên.
 * - `LINK_NOT_FOUND` (mục được chọn vừa bị xoá ở tab khác, review S1): câu báo ở chân hộp, hộp
 *   vẫn mở, chữ còn nguyên, và trang làm mới danh sách chọn.
 * - Danh mục và điểm đến đang ẩn vẫn chọn được (spec §2b.4), kèm nhãn phụ mờ "Hidden"
 *   (`catalogOption`, spec 2026-10-05 §2.2).
 * - Thành công: mở thẳng tab Details của tour mới — nó sinh ra đang tắt bán.
 */
const e = messages.admin.tours.editor;
const t = e.create;
const d = e.details;
const FORM_ID = 'new-tour';

export function NewTourDialog({
  options,
  create,
}: {
  options: TourEditorOptions;
  create: CreateTourAction;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Nút New tour — đích focus khi hộp đóng (review A2-8): Quick Create mở hộp mà không bấm nút
   * này, tới từ trang khác thì lúc mở focus đang ở `<body>`.
   */
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Quick Create (spec 2026-10-05 §2.5) mở hộp như bấm nút: lúc trang mount nếu menu vừa ghi
  // yêu cầu từ trang khác, hay ngay khi menu ghi yêu cầu trên chính trang này.
  useCreateRequest('tour', () => setOpen(true));

  return (
    <>
      <Button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t.action}
      </Button>
      {open ? (
        <NewTourForm
          options={options}
          create={create}
          finalFocus={triggerRef}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function NewTourForm({
  options,
  create,
  finalFocus,
  onClose,
}: {
  options: TourEditorOptions;
  create: CreateTourAction;
  finalFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setValues] = useState<TourCreateFormValues>(newTourFormValues);
  /**
   * Giá trị form ĐỌC qua danh sách chọn hiện tại: lượt làm mới sau `LINK_NOT_FOUND` bỏ mục vừa bị
   * xoá thì ô ấy về câu giữ chỗ và báo chọn lại, không in UUID thô (review G6-F4). Câu báo
   * `LINK_NOT_FOUND` ở chân hộp còn nguyên — nó chỉ tắt khi người dùng sửa một ô.
   */
  const values = clearDeletedCreateChoices(draft, options);
  /** Admin đã tự gõ ô slug chưa — gõ rồi thì tên thôi ghi đè nó. */
  const [slugTouched, setSlugTouched] = useState(false);
  /** Chỉ mắng SAU lần bấm tạo đầu tiên; lỗi là DERIVED nên sửa xong là tự biến. */
  const [showValidation, setShowValidation] = useState(false);
  /**
   * Khu làm việc của tour vừa tạo. Điều hướng là việc SAU lệnh (vòng review F17):
   * `router.push` nằm trong lệnh thì `try` của kit ôm cả nó (luật kit: `try` chỉ
   * ôm ĐÚNG lời gọi lệnh), và `onSettled` refresh thêm một lượt nữa — trang tour
   * mới dựng hai lần.
   */
  const createdHref = useRef<string | null>(null);

  const errors: TourCreateFormErrors = showValidation ? validateTourCreateForm(values) : {};
  const noOptions = options.categories.length === 0 || options.destinations.length === 0;

  const { pending, failure, onOpenChange, run, clearFailure } =
    useConfirmWrite<CreateTourContractCode>({
      isStale: () => false,
      errorCopy: createTourErrorCopy,
      onClose,
      // Thành công → mở khu làm việc của tour mới. Kết cục không rõ (GENERIC)
      // cũng tới đây: kéo bảng tươi về xem tour đã có chưa.
      onSettled: () => {
        const href = createdHref.current;
        createdHref.current = null;
        if (href) router.push(href);
        else router.refresh();
      },
    });

  function patch(next: Partial<TourCreateFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function patchTitle(title: string) {
    patch({
      title,
      slug: slugTouched ? values.slug : slugifyVietnamese(title, TOUR_SLUG_MAX),
    });
  }

  async function submit() {
    setShowValidation(true);
    if (noOptions || hasFormErrors(validateTourCreateForm(values))) return;
    /** Danh mục hay điểm đến được chọn vừa bị xoá ở tab khác (review S1). */
    let linkGone = false;
    await run(async () => {
      const result = await create(tourCreatePayload(values));
      if (!result.ok) {
        linkGone = result.code === 'LINK_NOT_FOUND';
        return { ok: false, code: result.code };
      }
      createdHref.current = tourStepHref(result.created.slug, 'details');
      return { ok: true, toast: { title: t.toast.title, description: t.toast.body } };
    });
    // Hộp ở lại với câu báo và chữ đã gõ; trang kéo danh sách chọn tươi về để Picker bỏ mục đã
    // xoá. Việc SAU lệnh, ngoài `try` của kit — cùng luật với điều hướng sau khi tạo.
    if (linkGone) router.refresh();
  }

  const slugError = failure === 'SLUG_TAKEN' ? createTourErrorCopy('SLUG_TAKEN') : errors.slug;
  const footerFailure = failure !== null && failure !== 'SLUG_TAKEN' ? failure : null;
  const field = (name: string) => `${FORM_ID}-${name}`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(DIALOG_FRAME, 'sm:max-w-lg')}
        showCloseButton={false}
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>{t.dialog.title}</DialogTitle>
          <DialogDescription>{t.dialog.body}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4">
            {noOptions ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t.noOptions}
              </p>
            ) : null}

            <FormField id={field('title')} label={d.title} error={errors.title}>
              {(describedBy) => (
                <Input
                  id={field('title')}
                  value={values.title}
                  disabled={pending}
                  aria-invalid={errors.title !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => patchTitle(event.target.value)}
                />
              )}
            </FormField>

            <FormField id={field('slug')} label={t.slug} hint={t.slugHint} error={slugError}>
              {(describedBy) => (
                <Input
                  id={field('slug')}
                  value={values.slug}
                  // Slug không phải câu văn: soát chính tả gạch đỏ nó, còn tự viết
                  // hoa hay tự sửa chữ trên điện thoại làm hỏng nó (lượt thử tay F14).
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={pending}
                  aria-invalid={slugError !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    setSlugTouched(true);
                    patch({ slug: event.target.value });
                  }}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={field('category')} label={d.category} error={errors.categoryId}>
                {(describedBy) => (
                  <Picker
                    id={field('category')}
                    value={values.categoryId}
                    options={options.categories.map(catalogOption)}
                    placeholder={d.categoryPlaceholder}
                    disabled={pending}
                    invalid={errors.categoryId !== undefined}
                    describedBy={describedBy}
                    onValueChange={(categoryId) => patch({ categoryId })}
                  />
                )}
              </FormField>
              <FormField
                id={field('destination')}
                label={t.primaryDestination}
                error={errors.primaryDestinationId}
              >
                {(describedBy) => (
                  <Picker
                    id={field('destination')}
                    value={values.primaryDestinationId}
                    options={options.destinations.map(catalogOption)}
                    placeholder={d.destinationPlaceholder}
                    disabled={pending}
                    invalid={errors.primaryDestinationId !== undefined}
                    describedBy={describedBy}
                    onValueChange={(primaryDestinationId) => patch({ primaryDestinationId })}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id={field('days')} label={d.durationDays} error={errors.durationDays}>
                {(describedBy) => (
                  <Input
                    id={field('days')}
                    inputMode="numeric"
                    value={values.durationDays}
                    disabled={pending}
                    aria-invalid={errors.durationDays !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ durationDays: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id={field('group')} label={d.maxGroupSize} error={errors.maxGroupSize}>
                {(describedBy) => (
                  <Input
                    id={field('group')}
                    inputMode="numeric"
                    value={values.maxGroupSize}
                    disabled={pending}
                    aria-invalid={errors.maxGroupSize !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ maxGroupSize: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id={field('price')} label={d.basePrice} error={errors.basePrice}>
                {(describedBy) => (
                  <Input
                    id={field('price')}
                    inputMode="decimal"
                    value={values.basePrice}
                    disabled={pending}
                    aria-invalid={errors.basePrice !== undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => patch({ basePrice: event.target.value })}
                  />
                )}
              </FormField>
            </div>
          </div>

          {footerFailure ? (
            <p role="alert" className="mt-4 text-sm text-destructive-emphasis">
              {createTourErrorCopy(footerFailure)}
            </p>
          ) : null}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t.dialog.cancel}
            </Button>
            <Button type="submit" disabled={pending || noOptions}>
              {pending ? t.dialog.submitting : t.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
