'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { safeRedirect } from '@/lib/safe-redirect';

const t = messages.admin.login;

/** Regex email cùng ngưỡng contract (EmailSchema) — chỉ chặn sớm phía form. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
  form?: string;
}

/**
 * Validate thuần cho form login admin — export cho unit test. Cùng triết lý
 * auth-form.ts của web: chỉ chặn rỗng + định dạng; đúng/sai credentials là
 * việc của server.
 */
export function validateAdminLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (email.trim().length === 0) errors.email = t.errors.emailRequired;
  else if (!EMAIL_RE.test(email.trim())) errors.email = t.errors.emailInvalid;
  if (password.length === 0) errors.password = t.errors.passwordRequired;
  return errors;
}

/**
 * Form đăng nhập admin (spec P4a §2): gọi `authClient.signIn.email`, thành
 * công theo `redirect` param (đã qua safeRedirect — chống open redirect).
 * KHÔNG có register/forgot — hai việc đó là của www (link ở trang login).
 * Tuyệt đối không dùng HTML validation (nếp form toàn dự án).
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const fieldErrors = validateAdminLogin(email, password);
    setErrors(fieldErrors);
    if (fieldErrors.email || fieldErrors.password) return;

    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (error) {
        // INVALID_EMAIL_OR_PASSWORD → câu riêng; còn lại câu chung. So sánh
        // code CHÍNH XÁC (bài học prefix INVALID_EMAIL của web).
        setErrors({
          form:
            error.code === 'INVALID_EMAIL_OR_PASSWORD'
              ? t.errors.invalidCredentials
              : t.errors.generic,
        });
        return;
      }
      // Vai trò ADMIN sẽ do layout gác cổng kiểm — CUSTOMER đăng nhập đúng
      // mật khẩu vẫn bị đá sang /not-authorized, không phải việc của form.
      router.push(safeRedirect(params.get('redirect')));
      router.refresh();
    } catch {
      setErrors({ form: t.errors.generic });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="admin-email">{t.email}</Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'admin-email-error' : undefined}
        />
        {errors.email ? (
          <p id="admin-email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="admin-password">{t.password}</Label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'admin-password-error' : undefined}
        />
        {errors.password ? (
          <p id="admin-password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
