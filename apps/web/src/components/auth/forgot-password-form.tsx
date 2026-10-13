'use client';

import { validateForgotPassword } from '@tourism/core';
import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { FieldError, invalidProps } from './field-error';
import { TicketCard } from './ticket-card';

// Ruột form /forgot-password (Task 4 — auth-pages-api): nối `authClient
// .requestPasswordReset`. Anti-enumeration TUYỆT ĐỐI: LUÔN chuyển state
// `sent` sau khi promise resolve, BẤT KỂ trường `error` trả về là gì (email
// tồn tại hay không) — cấm mọi nhánh so `error` ở đây, kẻo lộ email nào có
// tài khoản qua UI. Chỉ một lỗi THẬT (promise reject — mạng đứt, DNS hỏng…)
// mới hiện khối lỗi `generic` inline, ở lại form để khách thử lại.
//
// Sweep 19/08: email trống/sai định dạng bắt Ở CLIENT (`validateForgotPassword`)
// — đây là kiểm ĐỊNH DẠNG, không phải kiểm tồn tại, nên không mâu thuẫn với
// anti-enumeration ở trên. `noValidate` tắt bong bóng trình duyệt.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNetworkError(false);
    const found = validateForgotPassword(email);
    setEmailError(found);
    if (found) return;
    setPending(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch {
      setNetworkError(true);
    } finally {
      setPending(false);
    }
  }

  const t = messages.authForms.forgotPassword;
  const c = messages.authForms.common;

  return (
    <TicketCard stub={t.stub}>
      {sent ? (
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              {t.sentHeading}
              <span className="text-primary-emphasis italic"> {t.sentHeadingAccent}</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.sentBody}</p>
          </div>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="w-full cursor-pointer rounded-full border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t.sendAgain}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            {c.rememberedIt}{' '}
            <a href="/login" className="font-medium text-primary-emphasis hover:underline">
              {c.backToLogin}
            </a>
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              {t.heading}
              <span className="text-primary-emphasis italic"> {t.headingAccent}</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.lead}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">{c.emailLabel}</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(undefined);
              }}
              {...invalidProps('forgot-email-error', emailError)}
            />
            <FieldError id="forgot-email-error">{emailError}</FieldError>
          </div>

          {networkError && (
            <p role="alert" className="text-xs text-destructive-emphasis">
              {messages.authForms.errors.generic}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t.submitting : t.submit}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {c.rememberedIt}{' '}
            <a href="/login" className="font-medium text-primary-emphasis hover:underline">
              {c.backToLogin}
            </a>
          </p>
        </form>
      )}
    </TicketCard>
  );
}
