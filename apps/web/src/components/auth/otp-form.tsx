'use client';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@tourism/ui/components/input-otp';
import { useEffect, useState } from 'react';
import { TicketCard } from './ticket-card';

// Form OTP dùng chung cho /verify-email và /two-factor (plan Task 5): 6 ô
// input-otp chia 3+3, nút submit, đếm ngược resend 60s (useState/useEffect
// demo — static-first, KHÔNG gọi API). Trang 2FA truyền `extra` để gắn link
// "Use a recovery code" (toggle input text mock) dưới chân form.
const RESEND_SECONDS = 60;

interface OtpFormProps {
  /** Cuống vé — đổi theo trang, vd "BOARDING CHECK · EMAIL" */
  stub: string;
  heading: React.ReactNode;
  description: string;
  submitLabel: string;
  /** Khối phụ tuỳ trang, chèn dưới nút submit (vd recovery code của 2FA) */
  extra?: React.ReactNode;
}

export function OtpForm({ stub, heading, description, submitLabel, extra }: OtpFormProps) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Đếm ngược resend: mỗi giây trừ 1 tới 0 thì mở nút gửi lại
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <TicketCard stub={stub}>
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            {heading}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex justify-center py-1">
          <InputOTP maxLength={6}>
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

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {submitLabel}
        </button>

        {secondsLeft > 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Didn't get it? Resend in{' '}
            <span className="font-mono text-foreground">{secondsLeft}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setSecondsLeft(RESEND_SECONDS)}
            className="cursor-pointer text-center text-sm font-medium text-primary hover:underline"
          >
            Resend the code
          </button>
        )}

        {extra}
      </form>
    </TicketCard>
  );
}
