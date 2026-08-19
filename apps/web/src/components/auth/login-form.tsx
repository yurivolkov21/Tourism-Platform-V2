'use client';

import { messages } from '@tourism/i18n';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { GoogleIcon } from '@/components/icons/social';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, fieldOfAuthError, mapAuthError } from '@/lib/auth-errors';
import { type LoginErrors, validateLogin } from '@/lib/auth-form';
import { safeRedirect } from '@/lib/safe-redirect';
import { FieldError, invalidProps } from './field-error';
import { TicketCard } from './ticket-card';

// Ruột form /login (Task 2 — trang MẪU của cụm auth): heading accent italic,
// nút Google, separator chữ, email + password, remember + forgot, submit
// full-width, link register. Task 3 (auth-pages-api): nối state/handler gọi
// authClient thật — visual/markup/motion GIỮ NGUYÊN, chỉ thêm state + khối
// lỗi inline (khuôn `role="alert"` + `text-xs text-destructive-emphasis` mượn từ
// contact-split.tsx — repo chưa có khuôn lỗi form auth trước đây).
//
// Sweep bắt lỗi form 19/08: validate CLIENT trước khi gọi API (`validateLogin`
// — trống/sai định dạng báo NGAY DƯỚI ô), `noValidate` tắt bong bóng của
// trình duyệt (luật: không dùng `required`/HTML validation), lỗi server có ô
// (`fieldOfAuthError`) hiện dưới ô đó, còn lại (401, throttle, mạng) ở khối
// lỗi cấp form như cũ.
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});

  // Gõ lại vào ô đang lỗi thì xoá lỗi của RIÊNG ô đó (khuôn `set` của
  // private-trip-form) — lỗi cũ treo mãi khi khách đã sửa là gây nhiễu.
  const clearField = (key: keyof LoginErrors) =>
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const found = validateLogin({ email, password });
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC với error envelope ({ error }) ở nhánh dưới. Không try/catch thì
    // nút kẹt pending vĩnh viễn và khách không thấy lỗi gì cả.
    try {
      const { error } = await authClient.signIn.email({ email, password, rememberMe });
      if (error) {
        const key = mapAuthError(error);
        const field = fieldOfAuthError(key);
        // Login chỉ có hai ô; `currentPassword` không tồn tại ở đây → về cấp form.
        if (field === 'email' || field === 'password') {
          setFieldErrors({ [field]: messages.authForms.errors[key] });
        } else {
          setFormError(key);
        }
        return;
      }
      router.push(safeRedirect(searchParams.get('redirect')));
      router.refresh();
    } catch {
      setFormError('generic');
    } finally {
      setPending(false);
    }
  }

  // Google chuyển hướng khỏi trang khi thành công — chỉ có lỗi (chưa cấu hình
  // provider ở API) mới còn ở lại để hiện inline.
  async function handleGoogleSignIn() {
    setFormError(null);
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${safeRedirect(searchParams.get('redirect'))}`,
      });
      if (error) {
        setFormError(mapAuthError(error));
      }
    } catch {
      // fetch reject thật (mạng đứt) — cùng lý do khối try/catch ở trên.
      setFormError('generic');
    }
  }

  return (
    <TicketCard stub="HN → SAPA · SEAT 07/12 · GATE: LOGIN">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            Welcome back
            <span className="text-primary-emphasis italic"> to the road.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Log in to pick up where the map left off.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </button>

        {/* Separator chữ giữa hai lối đăng nhập */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          or continue with email
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField('email');
            }}
            {...invalidProps('login-email-error', fieldErrors.email)}
          />
          <FieldError id="login-email-error">{fieldErrors.email}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearField('password');
            }}
            {...invalidProps('login-password-error', fieldErrors.password)}
          />
          <FieldError id="login-password-error">{fieldErrors.password}</FieldError>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label
            htmlFor="login-remember"
            className="flex cursor-pointer items-center gap-2 text-muted-foreground"
          >
            <Checkbox id="login-remember" checked={rememberMe} onCheckedChange={setRememberMe} />
            Remember me
          </label>
          <a href="/forgot-password" className="font-medium text-primary-emphasis hover:underline">
            Forgot password?
          </a>
        </div>

        {formError && (
          <p role="alert" className="text-xs text-destructive-emphasis">
            {messages.authForms.errors[formError]}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? messages.authForms.login.submitting : 'Board the trip'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <a href="/register" className="font-medium text-primary-emphasis hover:underline">
            Create an account
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
