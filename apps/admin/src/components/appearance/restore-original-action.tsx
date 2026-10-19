'use client';

import type { SiteImageSlotKey } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { SafeImg } from '@/components/kit/safe-img';
import type { SlotVM } from '@/lib/appearance-view';
import {
  isSetSlotStale,
  restorePayload,
  type SetSlotAction,
  type SetSlotContractCode,
  setSlotErrorCopy,
} from '@/lib/appearance-write';

/**
 * Restore original (spec P4f Appearance §6.1, plan 19/10): khe về ảnh gốc của bảng ảnh gốc và alt
 * gốc, qua hộp xác nhận chứ không mở hộp Replace — lệnh đã biết hết tham số, chỉ còn hỏi "chắc
 * chưa". Câu hệ quả đổi theo ảnh đang dùng: ảnh tải lên cho khe sẽ bị xoá sau 7 ngày (giọng đỏ),
 * còn lại không mất gì (giọng trung tính).
 */
const t = messages.admin.appearance;
const r = t.restoreDialog;

export function RestoreOriginalAction({
  slot,
  imageKey,
  setSlot,
  disabled,
  onSettled,
}: {
  slot: SlotVM;
  imageKey: SiteImageSlotKey;
  setSlot: SetSlotAction;
  disabled: boolean;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!slot.canRestore) return null;

  const uploaded = slot.image?.source === 'UPLOAD';
  const warning = uploaded ? r.uploadedGone : slot.image === null ? r.empty : r.kept;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t.restoreLabel(slot.name)}
        disabled={disabled}
        focusableWhenDisabled
        onClick={() => setOpen(true)}
      >
        <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        {t.restore}
      </Button>
      {open ? (
        <ConfirmWriteDialog<SetSlotContractCode>
          copy={{
            title: r.title,
            body: r.body,
            warning,
            submit: r.submit,
            submitting: r.submitting,
            cancel: r.cancel,
          }}
          warningTone={uploaded ? 'destructive' : 'neutral'}
          rows={[
            { label: r.rows.slot, value: slot.name },
            { label: r.rows.current, value: slot.image?.sourceLabel ?? r.noPhoto },
          ]}
          extra={
            <figure className="grid gap-1">
              <SafeImg
                src={slot.original.thumbUrl}
                alt=""
                className="h-24 w-fit max-w-full rounded-md bg-muted object-cover"
                brokenClassName="w-36"
              />
              <figcaption className="text-xs text-muted-foreground">{r.originalCaption}</figcaption>
            </figure>
          }
          onSubmit={async () => {
            const result = await setSlot(restorePayload(imageKey, slot));
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.toast.restored, description: t.toast.restoredBody(slot.name) },
            };
          }}
          isStale={isSetSlotStale}
          errorCopy={setSlotErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={onSettled}
        />
      ) : null}
    </>
  );
}
