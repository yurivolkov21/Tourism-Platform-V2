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
import { AccountActionError } from '@/components/account/account-action-error';
import { AccountDeleteError, deleteAccount } from '@/lib/api/account';
import { authClient } from '@/lib/auth-client';

/** Chữ khách phải gõ ĐÚNG để mở khoá nút xoá — spec §3, gate CHỈ ở UI (A1
 *  tĩnh). Hằng số ở đây (không phải i18n) vì đây là điều kiện SO KHỚP, không
 *  phải copy hiển thị tự do — đổi ngôn ngữ không được đổi chữ khách phải gõ. */
const CONFIRM_WORD = 'DELETE';

type DeleteAccountErrorKind =
  | 'sessionExpired'
  | 'wrongPassword'
  | 'paidBookings'
  | 'openCancellation'
  | 'noPassword'
  | 'generic';

/** Map mã lỗi API (ADR-0017 §7b) → kind hiển thị; mã lạ rơi về generic. */
function kindOfDeleteError(error: unknown): DeleteAccountErrorKind {
  if (!(error instanceof AccountDeleteError)) return 'generic';
  if (error.status === 401) return 'sessionExpired';
  switch (error.code) {
    case 'INVALID_PASSWORD':
      return 'wrongPassword';
    case 'ACCOUNT_HAS_PAID_BOOKINGS':
      return 'paidBookings';
    case 'ACCOUNT_HAS_OPEN_CANCELLATION':
      return 'openCancellation';
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'noPassword';
    default:
      return 'generic';
  }
}

/**
 * Xoá tài khoản — Task 8: không còn là một MỤC riêng (`AccountSection`
 * "Danger zone" với title/description do page.tsx cấp), mà là khối CUỐI
 * TRANG, đứng NGOÀI mọi section, ngăn với nội dung phía trên bằng một
 * `border-t`. Component nay TỰ mang heading nhỏ + một câu mô tả (trước đây
 * page.tsx truyền vào qua `AccountSection`) vì không còn khung section nào
 * cấp hộ nữa.
 *
 * Nút mở dialog hạ cấp từ `Button variant="destructive" size="lg"` xuống
 * text-link (`variant="link"` + `text-destructive-emphasis`, cùng khuôn
 * `booking-actions.tsx` dùng cho "Cancel booking") — sức nặng cảnh báo do
 * CHỮ mang (dialog xác nhận gõ-để-chắc), không do một nút to màu đỏ nằm lẻ
 * cuối trang.
 *
 * Dialog xác nhận gõ đúng `CONFIRM_WORD` GIỮ NGUYÊN từ `danger-zone.tsx`
 * (đổi tên file, không đổi logic): gõ sai/để trống → nút khoá; input reset
 * khi dialog đóng để lần mở sau không kế thừa trạng thái cũ.
 *
 * Task 7 (A2): bấm xác nhận → `DELETE /api/account` (tombstone) → THÀNH CÔNG
 * mới `authClient.signOut()` (dọn session client, ADR-0017 §2) → `router.
 * push('/')` + toast. `AlertDialogAction` KHÔNG tự đóng dialog khi lỗi (xem
 * `alert-dialog.tsx` — chỉ `AlertDialogCancel` bọc `Close`), nên message lỗi
 * hiện NGAY trong dialog, khách không mất chữ đã gõ.
 */
export function DeleteAccount() {
  const t = messages.accountProfile.danger;
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<DeleteAccountErrorKind | null>(null);
  // ADR-0017 §7b: chữ xác nhận là gate chống bấm-nhầm; mật khẩu là gate xác
  // thực lại phía SERVER — cả hai phải có mới mở nút.
  const isUnlocked = confirmText === CONFIRM_WORD && password.length > 0;

  async function handleConfirm() {
    if (!isUnlocked || pending) return;
    setPending(true);
    setErrorKind(null);
    try {
      await deleteAccount(password);
      await authClient.signOut();
      toast.success(messages.accountProfile.toast.accountDeletedTitle, {
        description: messages.accountProfile.toast.accountDeletedBody,
      });
      router.push('/');
    } catch (error) {
      setErrorKind(kindOfDeleteError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 border-t pt-8">
      <h2 className="text-sm font-medium text-foreground">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-3">
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setConfirmText('');
              setPassword('');
              setErrorKind(null);
            }
          }}
        >
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-destructive-emphasis"
              >
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
              <Label htmlFor="delete-account-confirm">{t.typeToConfirm(CONFIRM_WORD)}</Label>
              <Input
                id="delete-account-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-account-password">{t.passwordLabel}</Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorKind ? (
              <AccountActionError
                expired={errorKind === 'sessionExpired'}
                redirectTo="/account/profile"
                fallback={
                  errorKind === 'sessionExpired' || errorKind === 'generic'
                    ? messages.accountActionErrors.generic
                    : t.errors[errorKind]
                }
              />
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
      </div>
    </div>
  );
}
