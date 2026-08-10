'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, mapAuthError } from '@/lib/auth-errors';

/** 'mismatch' — validate CLIENT thuần (confirm ≠ new), không đụng API. 401
 *  giữa chừng có UI riêng (message + link đăng nhập lại, spec §5), tách khỏi
 *  `mapAuthError` (bản đó map 401 → 'invalidCredentials', sai ngữ nghĩa ở
 *  đây — đây không phải màn đăng nhập). */
type PasswordErrorKind = 'sessionExpired' | 'mismatch' | AuthErrorKey;

/**
 * Đổi mật khẩu (spec §3) — Task 7 (A2): nối
 * `authClient.changePassword({ currentPassword, newPassword })`.
 *
 * `currentPassword` là field BẮT BUỘC của Better Auth (`z.ZodString`, không
 * `.optional()` — đối chiếu `update-user.mjs`/`.d.mts` gói pin 1.6.23, KHÔNG
 * đoán, bài học `'max'`) nhưng markup pha A1 KHÔNG có field này — thêm tối
 * thiểu ở đây để form CHẠY ĐƯỢC (không phải một vòng thiết kế lại, xem
 * AMENDED 06/08 trong spec — "vòng thiết kế lại" nằm ở session khác do user
 * tự lo).
 */
export function ChangePasswordForm({ onDone }: { onDone?: () => void } = {}) {
  const t = messages.accountProfile.password;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<PasswordErrorKind | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKind(null);
    if (newPassword !== confirmPassword) {
      setErrorKind('mismatch');
      return;
    }
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật — KHÁC error envelope
    // ({error}) ở nhánh dưới (bài học pending-kẹt cụm auth).
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword });
      if (error) {
        setErrorKind(error.status === 401 ? 'sessionExpired' : mapAuthError(error));
        return;
      }
      toast.success(messages.accountProfile.toast.passwordUpdatedTitle);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Đổi xong thì đóng dòng lại — để mở với ba ô rỗng trông như chưa lưu.
      onDone?.();
    } catch {
      setErrorKind('generic');
    } finally {
      setPending(false);
    }
  }

  return (
    /* KHÔNG khung card riêng nữa: form này nay nằm TRONG một dòng của danh
       sách tóm tắt, thêm viền nữa là hộp lồng hộp. */
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-current-password">{t.currentLabel}</Label>
        <Input
          id="profile-current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-new-password">{t.newLabel}</Label>
        <Input
          id="profile-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-confirm-password">{t.confirmLabel}</Label>
        <Input
          id="profile-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      {errorKind ? (
        <AccountActionError
          expired={errorKind === 'sessionExpired'}
          redirectTo="/account/profile"
          // Nhánh `sessionExpired` trả null có chủ đích: nó KHÔNG bao giờ được
          // dùng (component đã hiện UI riêng khi `expired`), nhưng phải có mặt
          // để TypeScript THU HẸP `errorKind` — không có nó thì `errorKind` vẫn
          // mang cả 'sessionExpired', vốn không phải khoá của `authForms.errors`.
          // Ternary nội tuyến trước đây thu hẹp sẵn; truyền prop thì mất.
          //
          // `mismatch` là lỗi do MÌNH kiểm ở client (hai ô mật khẩu mới không
          // khớp), không đến từ server, nên cũng không nằm trong bảng đó.
          fallback={
            errorKind === 'sessionExpired'
              ? null
              : errorKind === 'mismatch'
                ? t.mismatch
                : messages.authForms.errors[errorKind]
          }
        />
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {t.submit}
      </Button>
    </form>
  );
}
