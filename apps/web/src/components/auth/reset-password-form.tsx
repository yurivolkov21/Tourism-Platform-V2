'use client';

import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, mapAuthError } from '@/lib/auth-errors';
import { PasswordStrengthField } from './password-strength-field';
import { TicketCard } from './ticket-card';

// Ruột form /reset-password (Task 4, chỉnh vòng 2 — dùng chung
// PasswordStrengthField với /register). `token` từ query `?token=` do API
// gắn khi redirect từ email (Better Auth); đọc qua `useSearchParams` — cùng
// kỹ thuật `redirect` của login-form (Task 3), nên page.tsx phải bọc
// `<Suspense>` quanh component này (Next 16 static prerender).
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // token luôn có giá trị khi form này render (nhánh thiếu token return
    // sớm bên dưới) — ép kiểu ở đây để khỏi lặp null-check vô nghĩa.
    if (!token) return;
    setFormError(null);
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC với error envelope ({ error }) ở nhánh dưới. Không try/catch thì
    // nút kẹt pending vĩnh viễn và khách không thấy lỗi gì cả.
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) {
        setFormError(mapAuthError(error));
        return;
      }
      toast.success(messages.authForms.resetPassword.toast.title, {
        description: messages.authForms.resetPassword.toast.body,
      });
      router.push('/login');
    } catch {
      setFormError('generic');
    } finally {
      setPending(false);
    }
  }

  // Thiếu/rỗng `?token=` — link email hỏng hoặc đã cũ. Panel lỗi thân thiện
  // (khuôn `unsubscribePage.invalidToken`/`InvalidTokenPanel`), KHÔNG 404,
  // dẫn thẳng về /forgot-password để xin link mới — KHÔNG gọi
  // `authClient.resetPassword` với token rỗng.
  if (!token) {
    const t = messages.authForms.resetPassword.invalidToken;
    return (
      <TicketCard stub="REISSUE TICKET · GATE: RESET">
        <div className="flex flex-col gap-5 text-center">
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              {t.heading}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.body}</p>
          </div>
          <a
            href="/forgot-password"
            className="w-full cursor-pointer rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.backLink}
          </a>
        </div>
      </TicketCard>
    );
  }

  return (
    <TicketCard stub="REISSUE TICKET · GATE: RESET">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            Fresh ticket,
            <span className="text-primary-emphasis italic"> same destination.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick a new password and you're back on board.
          </p>
        </div>

        <PasswordStrengthField
          id="reset-password"
          label="New password"
          placeholder="Password"
          value={password}
          onChange={setPassword}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <Input id="reset-confirm" type="password" placeholder="Type it once more" />
        </div>

        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {messages.authForms.errors[formError]}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? messages.authForms.resetPassword.submitting : 'Save and board again'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Changed your mind?{' '}
          <a href="/login" className="font-medium text-primary-emphasis hover:underline">
            Back to log in
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
