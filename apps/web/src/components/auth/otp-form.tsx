'use client';

import { messages } from '@tourism/i18n';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@tourism/ui/components/input-otp';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, mapAuthError } from '@/lib/auth-errors';
import { safeRedirect } from '@/lib/safe-redirect';
import { TicketCard } from './ticket-card';

// Form OTP dùng chung cho /verify-email và /two-factor: 6 ô input-otp chia
// 3+3, nút submit, đếm ngược resend 60s. Trang 2FA truyền `extra` để gắn link
// "Use a recovery code" (toggle input text mock) dưới chân form.
//
// Task 5 (auth-pages-api): verify-email nối API thật qua prop `email`. 2FA
// (TwoFactorForm) KHÔNG truyền prop này — plugin twoFactor chưa bật (PARK,
// ADR-0017 §5b) — nên `email === undefined` giữ NGUYÊN hành vi tĩnh cũ
// (submit no-op, resend chỉ reset đếm ngược, không gọi authClient). Chỉ khi
// caller truyền `email` tường minh (kể cả `null`, khi /verify-email thiếu
// query) mới vào "live mode": null → panel hướng dẫn về /login; có giá trị →
// wire verifyEmail/sendVerificationOtp thật.
const RESEND_SECONDS = 60;

interface OtpFormProps {
  /** Cuống vé — đổi theo trang, vd "BOARDING CHECK · EMAIL" */
  stub: string;
  heading: React.ReactNode;
  description: string;
  submitLabel: string;
  /** Khối phụ tuỳ trang, chèn dưới nút submit (vd recovery code của 2FA) */
  extra?: React.ReactNode;
  /**
   * Email đang verify (live mode — /verify-email). KHÔNG truyền (undefined)
   * ⇒ form tĩnh mock cũ cho /two-factor, xem doc-comment phía trên.
   */
  email?: string | null;
  /** query `?redirect=` đọc ở page server — chỉ có tác dụng ở live mode. */
  redirect?: string | null;
}

export function OtpForm({
  stub,
  heading,
  description,
  submitLabel,
  extra,
  email,
  redirect,
}: OtpFormProps) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);

  // Live mode CHỈ bật khi caller truyền prop `email` (kể cả giá trị null) —
  // xem doc-comment ở khai báo `OtpFormProps.email`.
  const isLiveMode = email !== undefined;

  // Đếm ngược resend: mỗi giây trừ 1 tới 0 thì mở nút gửi lại
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Static mode (2FA, chưa nối API) — giữ hành vi cũ: không làm gì.
    if (!isLiveMode || !email) return;

    setFormError(null);
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC với error envelope ({ error }) ở nhánh dưới. Không try/catch thì
    // nút kẹt pending vĩnh viễn và khách không thấy lỗi gì cả.
    try {
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
      if (error) {
        // OTP sai — CHỈ hiện lỗi inline, KHÔNG đụng `secondsLeft` (countdown
        // resend giữ nguyên, đúng yêu cầu brief).
        setFormError(mapAuthError(error));
        return;
      }

      toast.success(messages.authForms.verifyEmail.toast.title, {
        description: messages.authForms.verifyEmail.toast.body,
      });
      router.push(safeRedirect(redirect));
      router.refresh();
    } catch {
      setFormError('generic');
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (!isLiveMode || !email) {
      // Static mode (2FA, chưa nối API) — giữ hành vi cũ: chỉ reset đếm ngược.
      setSecondsLeft(RESEND_SECONDS);
      return;
    }
    setFormError(null);
    try {
      await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      setSecondsLeft(RESEND_SECONDS);
    } catch {
      // fetch reject thật (mạng đứt) — hiện lỗi generic, KHÔNG reset đếm
      // ngược để khách biết trạng thái thật và thử lại đúng lúc.
      setFormError('generic');
    }
  }

  // Live mode nhưng thiếu email (query `?email=` rỗng/hỏng) — panel hướng dẫn
  // thân thiện, KHÔNG crash, cùng khuôn `resetPassword.invalidToken`.
  if (isLiveMode && !email) {
    const t = messages.authForms.verifyEmail.noEmail;
    return (
      <TicketCard stub={stub}>
        <div className="flex flex-col gap-5 text-center">
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              {t.heading}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.body}</p>
          </div>
          <a
            href="/login"
            className="w-full cursor-pointer rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.backLink}
          </a>
        </div>
      </TicketCard>
    );
  }

  return (
    <TicketCard stub={stub}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            {heading}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex justify-center py-1">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} className="size-11 text-base" />
              <InputOTPSlot index={1} className="size-11 text-base" />
              <InputOTPSlot index={2} className="size-11 text-base" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="size-11 text-base" />
              <InputOTPSlot index={4} className="size-11 text-base" />
              <InputOTPSlot index={5} className="size-11 text-base" />
            </InputOTPGroup>
          </InputOTP>
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
          {pending ? messages.authForms.verifyEmail.submitting : submitLabel}
        </button>

        {secondsLeft > 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Didn't get it? Resend in{' '}
            <span className="font-mono text-foreground">{secondsLeft}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="cursor-pointer text-center text-sm font-medium text-primary-emphasis hover:underline"
          >
            Resend the code
          </button>
        )}

        {extra}
      </form>
    </TicketCard>
  );
}
