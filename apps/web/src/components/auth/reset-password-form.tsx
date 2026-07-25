'use client';

import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useState } from 'react';
import { TicketCard } from './ticket-card';

// Ruột form /reset-password (plan Task 4) — password ×2 + THANH ĐỘ MẠNH 4 vạch
// đổi màu theo độ dài (mock thuần độ dài cho static-first; validate thật là nợ
// spec). Vạch dùng token: yếu = muted, dần lên primary.
const STRENGTH_LABELS = ['Too short', 'Getting there', 'Good', 'Trail-ready'] as const;

/** Chấm độ mạnh mock: 0–4 theo ngưỡng độ dài (8/10/12/16) */
function mockStrength(pw: string): number {
  return [8, 10, 12, 16].filter((n) => pw.length >= n).length;
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const strength = mockStrength(password);

  return (
    <TicketCard stub="REISSUE TICKET · GATE: RESET">
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            Fresh ticket,
            <span className="text-primary italic"> same destination.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick a new password and you're back on board.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Thanh độ mạnh: 4 vạch + nhãn, chỉ hiện khi bắt đầu gõ */}
          {password.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      strength >= step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {STRENGTH_LABELS[Math.max(0, strength - 1)]}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <Input id="reset-confirm" type="password" placeholder="Type it once more" />
        </div>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Save and board again
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Changed your mind?{' '}
          <a href="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
