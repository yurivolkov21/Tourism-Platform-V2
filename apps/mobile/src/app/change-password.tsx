import { mapAuthError } from '@tourism/core';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  type ChangePasswordAction,
  type ChangePasswordField,
  submitChangePassword,
} from '@/features/account/change-password-flow';
import { ChangePasswordScreen } from '@/features/account/change-password-screen';
import { getAuthClient } from '@/lib/auth-client';

/**
 * Route A6 (spec P5b-4 §3) — đổi mật khẩu, đã đăng nhập nên gọi thẳng
 * `getAuthClient()` (cùng khuôn `tours/[slug].tsx`), KHÔNG qua `AuthActions`
 * (seam đó chỉ phủ luồng sign-in/up/verify/reset của nhóm `(auth)`).
 */
export default function ChangePasswordRoute() {
  const [values, setValues] = useState<Record<ChangePasswordField, string>>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ChangePasswordField, string>>>({});
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const changePassword: ChangePasswordAction = async ({ currentPassword, newPassword }) => {
    try {
      // `revokeOtherSessions: true` bắt buộc (ADR-0017 §7a) — đổi mật khẩu
      // xong mà không thu hồi phiên khác là để kẻ cầm phiên cũ tiếp tục dùng.
      const { error } = await getAuthClient().changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
    } catch {
      return { ok: false, error: 'generic' };
    }
  };

  async function handleSubmit() {
    setFieldErrors({});
    setFormMessage(null);
    setPending(true);
    const outcome = await submitChangePassword(values, changePassword);
    setPending(false);

    if (outcome.kind === 'done') {
      router.back();
      return;
    }
    if (outcome.kind === 'fieldErrors') {
      setFieldErrors(outcome.errors);
      return;
    }
    setFormMessage({ tone: outcome.tone, text: outcome.text });
  }

  return (
    <ChangePasswordScreen
      values={values}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      onChange={(field, value) => {
        setValues((current) => ({ ...current, [field]: value }));
        setFieldErrors((current) =>
          current[field] === undefined ? current : { ...current, [field]: undefined },
        );
      }}
      onSubmit={() => void handleSubmit()}
    />
  );
}
