'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type RevokeUserSessionsAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Đăng xuất mọi nơi (P4f). API nhận cả lúc 0 phiên (`revoked: 0`), nhưng nút tắt khi không
 * còn phiên nào sống — bấm một lệnh không làm gì chỉ để lại một dòng lịch sử vô nghĩa.
 */
const t = messages.admin.users.actions.sessions;

export function UserSessionsAction({
  detail,
  revokeSessions,
}: {
  detail: UserDetailVM;
  revokeSessions: RevokeUserSessionsAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  if (!detail.actions.includes('revokeSessions')) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing || detail.sessions.count === 0}
        onClick={() => setOpen(true)}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        {t.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          copy={{ ...t.dialog, cancel: messages.admin.users.actions.cancel }}
          rows={userConfirmRows(detail)}
          warningTone="neutral"
          onSubmit={async () => {
            const result = await revokeSessions({ id: detail.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(result.revoked) },
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
