'use client';

import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { TicketCard } from './ticket-card';

// Ruột form /forgot-password (Task 4 — auth-pages-api): nối `authClient
// .requestPasswordReset`. Anti-enumeration TUYỆT ĐỐI: LUÔN chuyển state
// `sent` sau khi promise resolve, BẤT KỂ trường `error` trả về là gì (email
// tồn tại hay không) — cấm mọi nhánh so `error` ở đây, kẻo lộ email nào có
// tài khoản qua UI. Chỉ một lỗi THẬT (promise reject — mạng đứt, DNS hỏng…)
// mới hiện khối lỗi `generic` inline, ở lại form để khách thử lại.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNetworkError(false);
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

  return (
    <TicketCard stub="LOST TICKET DESK · GATE: RESET">
      {sent ? (
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              Check your inbox
              <span className="text-primary italic"> — help is on the way.</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A reset link is on its way — it expires in 30 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="w-full cursor-pointer rounded-full border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Send it again
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Back to log in
            </a>
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              Lost your ticket?
              <span className="text-primary italic"> It happens on the road.</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We'll email you a link to reset it.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {networkError && (
            <p role="alert" className="text-xs text-destructive">
              {messages.authForms.errors.generic}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? messages.authForms.forgotPassword.submitting : 'Send the reset link'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Back to log in
            </a>
          </p>
        </form>
      )}
    </TicketCard>
  );
}
