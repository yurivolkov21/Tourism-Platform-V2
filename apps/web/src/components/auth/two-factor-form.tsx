'use client';

import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useState } from 'react';
import { OtpForm } from './otp-form';

// Ruột /two-factor (plan Task 5): OtpForm + khối "Use a recovery code" —
// toggle mở input text mock (static-first; TOTP thật là nợ twoFactor plugin).
// W3-C1: description/submit/recovery label dời vào @tourism/i18n (luật 7); W-09 (13/10) dời nốt
// cuống vé, tiêu đề và hai nút chuyển ô mã.
export function TwoFactorForm() {
  const [useRecovery, setUseRecovery] = useState(false);
  const t = messages.authForms.twoFactor;

  return (
    <OtpForm
      stub={t.stub}
      heading={
        <>
          {t.heading}
          <span className="text-primary-emphasis italic"> {t.headingAccent}</span>
        </>
      }
      description={t.description}
      submitLabel={t.submit}
      extra={
        useRecovery ? (
          <div className="flex flex-col gap-1.5 border-t border-dashed pt-4">
            <Label htmlFor="recovery-code">{t.recoveryLabel}</Label>
            <Input id="recovery-code" type="text" placeholder={t.recoveryPlaceholder} />
            <button
              type="button"
              onClick={() => setUseRecovery(false)}
              className="mt-1 cursor-pointer text-left text-sm font-medium text-primary-emphasis hover:underline"
            >
              {t.backToCode}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setUseRecovery(true)}
            className="cursor-pointer text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {t.useRecovery}
          </button>
        )
      }
    />
  );
}
