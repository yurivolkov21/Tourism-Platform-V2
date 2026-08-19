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
import { type RegisterErrors, validateRegister } from '@/lib/auth-form';
import { safeRedirect } from '@/lib/safe-redirect';
import { FieldError, invalidProps } from './field-error';
import { PasswordStrengthField } from './password-strength-field';
import { TicketCard } from './ticket-card';

// Ruột form /register (plan Task 3) — nhân từ mẫu login-form: heading accent
// italic, Google, separator, name/email/password, checkbox Terms, submit,
// link về /login. Task 3 (auth-pages-api): nối state/handler gọi authClient
// thật — visual/markup/motion GIỮ NGUYÊN. Checkbox Terms là gate client sẵn
// có: submit khoá (disabled) tới khi tick, không cần copy lỗi riêng.
//
// Sweep bắt lỗi form 19/08: `validateRegister` chặn trống/sai định dạng/mật
// khẩu ngoài 8–128 NGAY DƯỚI ô trước khi gọi API; `noValidate` tắt bong bóng
// trình duyệt; lỗi server có ô (email đã tồn tại, INVALID_EMAIL,
// PASSWORD_TOO_SHORT…) hiện dưới đúng ô đó qua `fieldOfAuthError`.
export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});

  const clearField = (key: keyof RegisterErrors) =>
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreedToTerms) return;
    setFormError(null);
    const found = validateRegister({ name, email, password });
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC với error envelope ({ error }) ở nhánh dưới. Không try/catch thì
    // nút kẹt pending vĩnh viễn và khách không thấy lỗi gì cả.
    try {
      const { error } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (error) {
        const key = mapAuthError(error);
        const field = fieldOfAuthError(key);
        if (field === 'email' || field === 'password') {
          setFieldErrors({ [field]: messages.authForms.errors[key] });
        } else {
          setFormError(key);
        }
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch {
      setFormError('generic');
    } finally {
      setPending(false);
    }
  }

  // Google chuyển hướng khỏi trang khi thành công — chỉ có lỗi (chưa cấu hình
  // provider ở API) mới còn ở lại để hiện inline. Cùng handler với login-form.
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
    <TicketCard stub="NEW TRAVELLER · SEAT --/-- · GATE: REGISTER">
      {/* gap-3 (các form auth khác gap-4): register là form dày nhất — 8 khối;
          nhịp 12px là điểm mà card vừa laptop 768p KỂ CẢ khi hiện đủ lỗi (đo
          19/08: 1366×681, 3 lỗi → 663px, dư 18px). */}
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        {/* Heading giữ text-2xl ở mọi cỡ (không lên 3xl ở md) — vòng nén
            19/08 cho vừa laptop 768p: 3xl xuống dòng thành 2 dòng 72px, 2xl
            một dòng. Login/forgot vẫn 3xl vì card ngắn hơn nhiều. */}
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground">
            Claim your seat
            <span className="text-primary-emphasis italic"> on the next trip.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">One account for every trip ahead.</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </button>

        {/* Separator chữ giữa hai lối đăng ký */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          or sign up with email
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        {/* Name + email cùng hàng từ sm (vòng nén 19/08): −68px dọc, và hai
            dòng lỗi của cặp này chia chung một hàng. Mobile vẫn xếp dọc. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-name">Full name</Label>
            <Input
              id="register-name"
              type="text"
              placeholder="Tran Mai Anh"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearField('name');
              }}
              {...invalidProps('register-name-error', fieldErrors.name)}
            />
            <FieldError id="register-name-error">{fieldErrors.name}</FieldError>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearField('email');
              }}
              {...invalidProps('register-email-error', fieldErrors.email)}
            />
            <FieldError id="register-email-error">{fieldErrors.email}</FieldError>
          </div>
        </div>
        {/* Password + chấm độ mạnh (playground.md user cung cấp, đã token hoá) */}
        <PasswordStrengthField
          id="register-password"
          label="Password"
          placeholder="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearField('password');
          }}
          error={fieldErrors.password}
        />

        <label
          htmlFor="register-terms"
          className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground"
        >
          <Checkbox
            id="register-terms"
            className="mt-0.5"
            checked={agreedToTerms}
            onCheckedChange={setAgreedToTerms}
          />
          <span>
            I agree to the{' '}
            <a href="/terms" className="font-medium text-primary-emphasis hover:underline">
              Terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="font-medium text-primary-emphasis hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {formError && (
          <p role="alert" className="text-xs text-destructive-emphasis">
            {messages.authForms.errors[formError]}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !agreedToTerms}
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? messages.authForms.register.submitting : 'Create my account'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already have a ticket?{' '}
          <a href="/login" className="font-medium text-primary-emphasis hover:underline">
            Log in
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
