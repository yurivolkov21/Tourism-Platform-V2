'use client';

import { POST_SLUG_MAX, slugifyVietnamese } from '@tourism/contract';
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
import { useRef, useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { hasFormErrors } from '@/lib/form-errors';
import { postEditorHref } from '@/lib/posts-view';
import {
  type CreatePostAction,
  type CreatePostContractCode,
  createPostErrorCopy,
  type PostCreateFormValues,
  postCreatePayload,
  validatePostCreateForm,
} from '@/lib/posts-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Hộp New post ở trang `/posts` (spec P4e-4 §4.3) — khuôn `NewTourDialog`: vòng đời lệnh
 * ghi của kit qua `useConfirmWrite`, mỗi ô một `FormField`.
 *
 * - Slug chạy theo tiêu đề bằng `slugifyVietnamese(title, 80)` tới khi admin chạm vào ô
 *   slug; câu "Set once" nói thẳng vì sao phải chọn kỹ (ADR-0051 §2).
 * - `SLUG_TAKEN` là lỗi của Ô SLUG: hiện dưới ô ấy, hộp vẫn mở, chữ còn nguyên.
 * - Thành công: mở thẳng trang sửa của bài mới — nó sinh ra là nháp.
 */
const t = messages.admin.posts.create;
const FORM_ID = 'new-post';
const EMPTY: PostCreateFormValues = { title: '', slug: '' };

export function NewPostDialog({ create }: { create: CreatePostAction }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t.action}
      </Button>
      {open ? <NewPostForm create={create} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NewPostForm({ create, onClose }: { create: CreatePostAction; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<PostCreateFormValues>(EMPTY);
  /** Admin đã tự gõ ô slug chưa — gõ rồi thì tiêu đề thôi ghi đè nó. */
  const [slugTouched, setSlugTouched] = useState(false);
  /** Chỉ báo lỗi SAU lần bấm tạo đầu tiên; lỗi là DERIVED nên sửa xong là tự biến. */
  const [showValidation, setShowValidation] = useState(false);
  /** Trang sửa của bài vừa tạo — điều hướng SAU lệnh, không nằm trong `try` của kit (bài học F17). */
  const createdHref = useRef<string | null>(null);

  const errors = showValidation ? validatePostCreateForm(values) : {};

  const { pending, failure, onOpenChange, run, clearFailure } =
    useConfirmWrite<CreatePostContractCode>({
      isStale: () => false,
      errorCopy: createPostErrorCopy,
      onClose,
      onSettled: () => {
        const href = createdHref.current;
        createdHref.current = null;
        if (href) router.push(href);
        else router.refresh();
      },
    });

  function patch(next: Partial<PostCreateFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function submit() {
    setShowValidation(true);
    if (hasFormErrors(validatePostCreateForm(values))) return;
    void run(async () => {
      const result = await create(postCreatePayload(values));
      if (!result.ok) return { ok: false, code: result.code };
      createdHref.current = postEditorHref(result.created.slug);
      return { ok: true, toast: { title: t.toast.title, description: t.toast.body } };
    });
  }

  const slugError = failure === 'SLUG_TAKEN' ? createPostErrorCopy('SLUG_TAKEN') : errors.slug;
  const footerFailure = failure !== null && failure !== 'SLUG_TAKEN' ? failure : null;
  const field = (name: string) => `${FORM_ID}-${name}`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-lg')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.dialog.title}</DialogTitle>
          <DialogDescription>{t.dialog.body}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4">
            <FormField id={field('title')} label={t.title} error={errors.title}>
              {(describedBy) => (
                <Input
                  id={field('title')}
                  value={values.title}
                  disabled={pending}
                  aria-invalid={errors.title !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    const title = event.target.value;
                    patch({
                      title,
                      slug: slugTouched ? values.slug : slugifyVietnamese(title, POST_SLUG_MAX),
                    });
                  }}
                />
              )}
            </FormField>

            <FormField id={field('slug')} label={t.slug} hint={t.slugHint} error={slugError}>
              {(describedBy) => (
                <Input
                  id={field('slug')}
                  value={values.slug}
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
          </div>

          {footerFailure ? (
            <p role="alert" className="mt-4 text-sm text-destructive-emphasis">
              {createPostErrorCopy(footerFailure)}
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
            <Button type="submit" disabled={pending}>
              {pending ? t.dialog.submitting : t.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
