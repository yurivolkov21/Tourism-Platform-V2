'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { safeRedirect } from '@/lib/safe-redirect';

const t = messages.admin.login;

/** Quên mật khẩu là flow của www (admin không có reset riêng — ADR-0026 §2). */
const FORGOT_PASSWORD_URL = 'https://www.nexora-travel.agency/forgot-password';

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
 * Form đăng nhập admin — bố cục theo wireframe ReUI auth-1 (vòng 20/08):
 * hàng label Password kèm link "Forgot password?" căn phải, input mật khẩu
 * có nút 👁 hiện/ẩn. Logic GIỮ NGUYÊN vòng P4a (spec §2): gọi
 * `authClient.signIn.email`, thành công theo `redirect` param đã qua
 * safeRedirect; KHÔNG HTML validation (nếp form toàn dự án).
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        // Siết verify 20/08: admin chưa verify → chỉ dẫn về flow OTP của www
        // (admin không có UI nhập OTP riêng — ADR-0026 §2).
        setErrors({
          form:
            error.code === 'INVALID_EMAIL_OR_PASSWORD'
              ? t.errors.invalidCredentials
              : error.code === 'EMAIL_NOT_VERIFIED'
                ? t.errors.emailNotVerified
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="admin-email">{t.email}</Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          className="bg-card"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="admin-password">{t.password}</Label>
          <a
            href={FORGOT_PASSWORD_URL}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.forgotPassword}
          </a>
        </div>
        <div className="relative">
          <Input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="bg-card pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'admin-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t.hidePassword : t.showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
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
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
