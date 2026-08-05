'use client';

import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/alert-dialog';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountDeleteError, deleteAccount } from '@/lib/api/account';
import { authClient } from '@/lib/auth-client';

/** Chữ khách phải gõ ĐÚNG để mở khoá nút xoá — spec §3, gate CHỈ ở UI (A1
 *  tĩnh). Hằng số ở đây (không phải i18n) vì đây là điều kiện SO KHỚP, không
 *  phải copy hiển thị tự do — đổi ngôn ngữ không được đổi chữ khách phải gõ. */
const CONFIRM_WORD = 'DELETE';

type DangerErrorKind = 'sessionExpired' | 'generic';

/**
 * Danger zone `/account/profile` (spec §3/§4) — xoá tài khoản, khoá sau
 * dialog confirm gõ đúng `CONFIRM_WORD`. Gõ sai/để trống → nút khoá; input
 * reset khi dialog đóng để lần mở sau không kế thừa trạng thái cũ.
 *
 * Task 7 (A2): bấm xác nhận → `DELETE /api/account` (tombstone) → THÀNH CÔNG
 * mới `authClient.signOut()` (dọn session client, ADR-0017 §2) → `router.
 * push('/')` + toast. `AlertDialogAction` KHÔNG tự đóng dialog khi lỗi (xem
 * `alert-dialog.tsx` — chỉ `AlertDialogCancel` bọc `Close`), nên message lỗi
 * hiện NGAY trong dialog, khách không mất chữ đã gõ.
 */
export function DangerZone() {
  const t = messages.accountProfile.danger;
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<DangerErrorKind | null>(null);
  const isUnlocked = confirmText === CONFIRM_WORD;

  async function handleConfirm() {
    if (!isUnlocked || pending) return;
    setPending(true);
    setErrorKind(null);
    try {
      await deleteAccount();
      await authClient.signOut();
      toast.success(messages.accountProfile.toast.accountDeletedTitle, {
        description: messages.accountProfile.toast.accountDeletedBody,
      });
      router.push('/');
    } catch (error) {
      setErrorKind(
        error instanceof AccountDeleteError && error.status === 401 ? 'sessionExpired' : 'generic',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="font-heading text-lg font-medium text-foreground">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmText('');
            setErrorKind(null);
          }
        }}
      >
        <AlertDialogTrigger
          render={
            <Button type="button" variant="destructive" className="mt-4">
              {t.deleteCta}
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.dialogBody}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="danger-zone-confirm">{t.typeToConfirm(CONFIRM_WORD)}</Label>
            <Input
              id="danger-zone-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>

          {errorKind ? (
            <p role="alert" className="text-sm text-destructive">
              {errorKind === 'sessionExpired' ? (
                <>
                  {messages.accountActionErrors.sessionExpired}{' '}
                  <a href="/login?redirect=/account/profile" className="underline">
                    {messages.accountActionErrors.loginLink}
                  </a>
                </>
              ) : (
                messages.accountActionErrors.generic
              )}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!isUnlocked || pending}
              onClick={handleConfirm}
            >
              {t.confirmCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
