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
 *
 * Nút tắt vì hết phiên thì giữ `disabled` thật khi trang vừa mở (như nút Reopen quá hạn của
 * chuyến), NHƯNG sau một lệnh ghi từ chính nút này thì khoá kiểu `aria-disabled`: hộp đóng trả
 * focus về đây, rồi lượt làm mới mang về 0 phiên — `disabled` thật lúc ấy đẩy focus bàn phím về
 * <body> (đo Chromium 13/10). Lúc trang đang làm mới cũng vậy (G6).
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
  /** Đã có một lệnh từ nút này chạm server — từ đó nút khoá mà vẫn giữ được focus. */
  const [wroteHere, setWroteHere] = useState(false);

  if (!detail.actions.includes('revokeSessions')) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing || detail.sessions.count === 0}
        focusableWhenDisabled={detail.sessions.count > 0 || wroteHere}
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
          onSettled={() => {
            setWroteHere(true);
            startRefresh(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
