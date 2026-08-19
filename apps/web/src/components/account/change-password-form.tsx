'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { FieldError, invalidProps } from '@/components/auth/field-error';
import { PasswordStrengthField } from '@/components/auth/password-strength-field';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, fieldOfAuthError, mapAuthError } from '@/lib/auth-errors';
import { type ChangePasswordErrors, validateChangePassword } from '@/lib/auth-form';

/** 401 giữa chừng có UI riêng (message + link đăng nhập lại, spec §5), tách
 *  khỏi `mapAuthError` (bản đó map 401 → 'invalidCredentials', sai ngữ nghĩa
 *  ở đây — đây không phải màn đăng nhập). Lỗi TỪNG Ô (trống, ngắn, không
 *  khớp — sweep 19/08) không đi qua đây mà nằm ở `fieldErrors`. */
type PasswordErrorKind = 'sessionExpired' | AuthErrorKey;

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
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordErrors>({});

  const clearField = (key: keyof ChangePasswordErrors) =>
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKind(null);
    // Sweep 19/08: ba ô kiểm ở client (trống / mới 8–128 / xác nhận khớp)
    // trước khi gọi API — trước đó chỉ so khớp, ô trống vẫn gửi đi rồi nhận
    // 400 chung chung.
    const found = validateChangePassword({ currentPassword, newPassword, confirmPassword });
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật — KHÁC error envelope
    // ({error}) ở nhánh dưới (bài học pending-kẹt cụm auth).
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword });
      if (error) {
        if (error.status === 401) {
          setErrorKind('sessionExpired');
          return;
        }
        // INVALID_PASSWORD (mật khẩu hiện tại sai) → dưới ô hiện tại;
        // PASSWORD_TOO_* → dưới ô mật khẩu mới; còn lại ở khối lỗi chung.
        const key = mapAuthError(error);
        const field = fieldOfAuthError(key);
        if (field === 'currentPassword') {
          setFieldErrors({ currentPassword: messages.authForms.errors[key] });
        } else if (field === 'password') {
          setFieldErrors({ newPassword: messages.authForms.errors[key] });
        } else {
          setErrorKind(key);
        }
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
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            clearField('currentPassword');
          }}
          {...invalidProps('profile-current-password-error', fieldErrors.currentPassword)}
        />
        <FieldError id="profile-current-password-error">{fieldErrors.currentPassword}</FieldError>
      </div>
      {/* Ô mật khẩu MỚI dùng chung PasswordStrengthField với register/reset
          (góp ý user 12/08): vạch điểm + checklist 5 yêu cầu tick dần —
          chế độ controlled để submit đọc được giá trị thật. */}
      <PasswordStrengthField
        id="profile-new-password"
        label={t.newLabel}
        value={newPassword}
        onChange={(value) => {
          setNewPassword(value);
          clearField('newPassword');
        }}
        error={fieldErrors.newPassword}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-confirm-password">{t.confirmLabel}</Label>
        <Input
          id="profile-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            clearField('confirmPassword');
          }}
          {...invalidProps('profile-confirm-password-error', fieldErrors.confirmPassword)}
        />
        <FieldError id="profile-confirm-password-error">{fieldErrors.confirmPassword}</FieldError>
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
          fallback={errorKind === 'sessionExpired' ? null : messages.authForms.errors[errorKind]}
        />
      ) : null}

      {/* Cancel: đồng bộ với dòng tên/phone (nút Save/Cancel cạnh nhau) —
          trước bản này dòng mật khẩu chỉ có nút Save, không có đường lùi
          giữa chừng. `onClick={onDone}` dùng lại ĐÚNG callback "đóng dòng"
          sau khi lưu — không cần dọn `currentPassword`/`newPassword`/
          `confirmPassword` riêng vì dòng đóng thì component này unmount,
          state cục bộ mất theo, không rò sang lần mở kế tiếp. */}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {t.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {messages.accountProfile.summary.cancelEdit}
        </Button>
      </div>
    </form>
  );
}
