'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type SetUserRoleAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Nút cấp hoặc thu Staff (P4f). Chỉ hiện khi `userActions` cho phép — khách chưa xác minh hay
 * đang khoá không có nút (card Access nói vì sao). Vòng đời lệnh ở kit `ConfirmWriteDialog`;
 * file này chỉ còn phần domain. Nhận `setRole` từ trang — test dựng với hàm giả.
 */
const t = messages.admin.users.actions;

export function UserRoleAction({
  detail,
  setRole,
}: {
  detail: UserDetailVM;
  setRole: SetUserRoleAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  const mode = detail.actions.includes('grantStaff')
    ? 'grant'
    : detail.actions.includes('revokeStaff')
      ? 'revoke'
      : null;
  if (mode === null) return null;
  const copy = t[mode];

  return (
    <>
      <Button
        type="button"
        variant={mode === 'grant' ? 'default' : 'outline'}
        size="sm"
        disabled={isRefreshing}
        // Khoá mà vẫn nhận focus (`aria-disabled`): hộp đóng đúng lúc trang làm mới, và Base UI
        // trả focus về nút đã mở nó — nút `disabled` thật thì focus rơi về <body> (khuôn G6).
        focusableWhenDisabled
        onClick={() => setOpen(true)}
      >
        {mode === 'grant' ? (
          <ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <ShieldOffIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {copy.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          copy={{ ...copy.dialog, cancel: t.cancel }}
          rows={userConfirmRows(detail)}
          submitVariant={mode === 'revoke' ? 'destructive' : 'default'}
          // Cấp quyền không lấy đi gì — câu cảnh báo của nó là câu TRẤN AN.
          warningTone={mode === 'revoke' ? 'destructive' : 'neutral'}
          onSubmit={async () => {
            const result = await setRole({
              id: detail.id,
              role: mode === 'grant' ? 'STAFF' : 'CUSTOMER',
            });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: copy.toast.title, description: copy.toast.body(detail.name) },
            };
          }}
          isStale={isUserWriteStale}
          errorCopy={userWriteErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={() => startRefresh(() => router.refresh())}
        />
      ) : null}
    </>
  );
}
