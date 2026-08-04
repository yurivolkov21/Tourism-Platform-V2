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
import { useState } from 'react';

/** Chữ khách phải gõ ĐÚNG để mở khoá nút xoá — spec §3, gate CHỈ ở UI (A1
 *  tĩnh). Hằng số ở đây (không phải i18n) vì đây là điều kiện SO KHỚP, không
 *  phải copy hiển thị tự do — đổi ngôn ngữ không được đổi chữ khách phải gõ. */
const CONFIRM_WORD = 'DELETE';

/**
 * Danger zone `/account/profile` (spec §3/§4) — xoá tài khoản, khoá sau
 * dialog confirm gõ đúng `CONFIRM_WORD`. A1: KHÔNG gọi API, nút xác nhận chỉ
 * mở khoá theo state cục bộ (Task 7/A2 mới nối `DELETE /api/account` +
 * `signOut()`). Gõ sai/để trống → nút khoá; input reset khi dialog đóng để
 * lần mở sau không kế thừa trạng thái cũ.
 */
export function DangerZone() {
  const t = messages.accountProfile.danger;
  const [confirmText, setConfirmText] = useState('');
  const isUnlocked = confirmText === CONFIRM_WORD;

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="font-heading text-lg font-medium text-foreground">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmText('');
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

          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={!isUnlocked}>
              {t.confirmCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
