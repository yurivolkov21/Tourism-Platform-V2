'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { LockIcon, LockOpenIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type LockUserAction,
  type UnlockUserAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Khoá hoặc mở khoá (P4f, ADR-0052 §4). Khoá bắt buộc lý do — ô ghi chú của kit với
 * `noteRequired`, trần 500 của kit đúng bằng `USER_LOCK_REASON_MAX` (plan P4f, quyết định 8).
 * Owner chỉ có nút khi đang khoá — `userActions` quyết.
 */
const t = messages.admin.users.actions;

export function UserLockAction({
  detail,
  lock,
  unlock,
}: {
  detail: UserDetailVM;
  lock: LockUserAction;
  unlock: UnlockUserAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  const mode = detail.actions.includes('lock')
    ? 'lock'
    : detail.actions.includes('unlock')
      ? 'unlock'
      : null;
  if (mode === null) return null;

  const shared = {
    rows: userConfirmRows(detail),
    isStale: isUserWriteStale,
    errorCopy: userWriteErrorCopy,
    onClose: () => setOpen(false),
    onSettled: () => startRefresh(() => router.refresh()),
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing}
        // Như nút Staff access: khoá mà vẫn nhận focus lúc trang làm mới (khuôn G6).
        focusableWhenDisabled
        onClick={() => setOpen(true)}
      >
        {mode === 'lock' ? (
          <LockIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <LockOpenIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {t[mode].action}
      </Button>
      {open && mode === 'lock' ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          {...shared}
          copy={{ ...t.lock.dialog, cancel: t.cancel }}
          noteId={`user-lock-${detail.id}`}
          noteRequired={t.lock.dialog.noteRequired}
          submitVariant="destructive"
          onSubmit={async (reason) => {
            const result = await lock({ id: detail.id, reason });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.lock.toast.title, description: t.lock.toast.body(detail.name) },
            };
          }}
        />
      ) : null}
      {open && mode === 'unlock' ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          {...shared}
          copy={{ ...t.unlock.dialog, cancel: t.cancel }}
          warningTone="neutral"
          onSubmit={async () => {
            const result = await unlock({ id: detail.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: {
                title: t.unlock.toast.title,
                description: t.unlock.toast.body(detail.name),
              },
            };
          }}
        />
      ) : null}
    </>
  );
}
