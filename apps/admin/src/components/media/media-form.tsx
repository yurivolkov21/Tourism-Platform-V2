'use client';

import {
  type AdminMediaItem,
  MEDIA_ALT_MAX,
  MEDIA_AUTHOR_MAX,
  MEDIA_LICENSE_MAX,
  MEDIA_LICENSE_URL_MAX,
  MEDIA_SOURCE_URL_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import {
  altVariantLines,
  canSaveMedia,
  creditVariantLines,
  draftErrors,
  hasCcWarning,
  isMediaStale,
  type MediaContractCode,
  type MediaDraft,
  type MediaField,
  mediaDraft,
  mediaErrorCopy,
  mediaPayload,
  type UpdateMediaAction,
} from '@/lib/media-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Form alt và ghi công trong ngăn chi tiết (spec P4f Media §6.2, ADR-0060 §3): một lần lưu ghi cho
 * MỌI chỗ dùng của ảnh. Khi các chỗ dùng đang lệch nhau, form nói rõ lưu là làm chúng giống nhau và
 * liệt kê các giá trị đang khác. Giấy phép CC BY thiếu tác giả hay link chỉ bị cảnh báo.
 *
 * Vòng đời lệnh lưu là của kit `useConfirmWrite`: thành công thì toast; `STALE_MEDIA`, `NOT_FOUND`
 * hay kết cục không rõ thì toast lỗi — cả hai lối đều `router.refresh()`, và form dựng lại theo
 * version mới (cha đặt `key`). `ALT_REQUIRED` ở lại, thành lỗi của ô alt.
 */
const t = messages.admin.media;
const d = t.drawer;

const LIMITS: Record<MediaField, number> = {
  alt: MEDIA_ALT_MAX,
  author: MEDIA_AUTHOR_MAX,
  license: MEDIA_LICENSE_MAX,
  licenseUrl: MEDIA_LICENSE_URL_MAX,
  sourceUrl: MEDIA_SOURCE_URL_MAX,
};

export function MediaForm({
  item,
  licenses,
  update,
  onPendingChange,
}: {
  item: AdminMediaItem;
  licenses: string[];
  update: UpdateMediaAction;
  /** Ngăn không đóng giữa lúc lưu. */
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<MediaDraft>(() => mediaDraft(item));
  /** Lỗi từng ô chỉ hiện SAU lần bấm Save đầu tiên — gõ dở chưa phải là sai. */
  const [submitted, setSubmitted] = useState(false);

  const { pending, failure, run, clearFailure } = useConfirmWrite<MediaContractCode>({
    isStale: isMediaStale,
    errorCopy: mediaErrorCopy,
    // Ngăn không đóng theo lệnh lưu: form dựng lại theo version tươi sau `refresh`.
    onClose: () => {},
    onSettled: () => router.refresh(),
  });

  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);

  const errors = submitted ? draftErrors(item, draft) : {};
  const altError = errors.alt ?? (failure === 'ALT_REQUIRED' ? mediaErrorCopy(failure) : undefined);
  const formError = failure !== null && failure !== 'ALT_REQUIRED' ? mediaErrorCopy(failure) : null;
  const canSave = canSaveMedia(item, draft);
  const altLines = altVariantLines(item);
  const creditLines = creditVariantLines(item);

  function change(field: MediaField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    clearFailure();
  }

  function submit() {
    setSubmitted(true);
    if (!canSave || Object.keys(draftErrors(item, draft)).length > 0) return;
    void run(async () => {
      const result = await update(mediaPayload(item, draft));
      if (!result.ok) return { ok: false, code: result.code };
      return {
        ok: true,
        toast: { title: t.toast.saved, description: t.toast.savedBody(result.item.usages.length) },
      };
    });
  }

  const id = (field: MediaField) => `media-${field}`;
  const textField = (field: Exclude<MediaField, 'alt'>, label: string, hint?: string) => (
    <FormField id={id(field)} label={label} hint={hint} error={errors[field]}>
      {(describedBy) => (
        <Input
          id={id(field)}
          value={draft[field]}
          maxLength={LIMITS[field]}
          disabled={pending}
          inputMode={field === 'licenseUrl' || field === 'sourceUrl' ? 'url' : undefined}
          list={field === 'license' ? 'media-license-options' : undefined}
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={errors[field] ? true : undefined}
          onChange={(event) => change(field, event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <form
      noValidate
      className="grid gap-4 border-t pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {item.altVaries || item.creditVaries ? (
        <div className="grid gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{d.varies(item.usages.length)}</p>
          {altLines.length > 0 ? (
            <div className="grid gap-1">
              <p className="text-muted-foreground">{d.altVaries}</p>
              <ul className="grid gap-0.5">
                {altLines.map((line) => (
                  <li key={line.value} className="wrap-anywhere">
                    {line.value} <span className="text-muted-foreground">· {line.uses}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {creditLines.length > 0 ? (
            <div className="grid gap-1">
              <p className="text-muted-foreground">{d.creditVaries}</p>
              <ul className="grid gap-0.5">
                {creditLines.map((line, index) => (
                  // Hai bản ghi công có thể in ra cùng một dòng (khác nhau ở link) — khoá theo vị trí.
                  // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh của một lần vẽ
                  <li key={index} className="wrap-anywhere">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <FormField
        id={id('alt')}
        label={d.alt}
        hint={item.altRequired ? d.altRequiredHint : d.altOptionalHint}
        error={altError}
      >
        {(describedBy) => (
          <div className="grid gap-1">
            <Textarea
              id={id('alt')}
              rows={2}
              value={draft.alt}
              maxLength={MEDIA_ALT_MAX}
              disabled={pending}
              required={item.altRequired}
              aria-describedby={describedBy}
              aria-invalid={altError ? true : undefined}
              onChange={(event) => change('alt', event.target.value)}
            />
            <span className="justify-self-end text-xs tabular-nums text-muted-foreground">
              {d.altCounter(draft.alt.length, MEDIA_ALT_MAX)}
            </span>
          </div>
        )}
      </FormField>
      {textField('author', d.author)}
      {textField('license', d.license, d.licenseHint)}
      <datalist id="media-license-options">
        {licenses.map((license) => (
          <option key={license} value={license} />
        ))}
      </datalist>
      {textField('licenseUrl', d.licenseUrl, d.linkHint)}
      {textField('sourceUrl', d.sourceUrl, d.linkHint)}

      {hasCcWarning(draft) ? (
        <p className="text-sm text-warning-emphasis">{d.ccIncomplete}</p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {canSave ? null : <span className="text-xs text-muted-foreground">{d.unchanged}</span>}
        {/* `focusableWhenDisabled`: nút `disabled` thật làm Chromium đẩy focus về <body> giữa lúc
            lưu (đo 13/10 ở hộp sửa chuyến). */}
        <Button type="submit" disabled={pending || !canSave} focusableWhenDisabled>
          {pending ? d.saving : d.save}
        </Button>
      </div>
    </form>
  );
}
