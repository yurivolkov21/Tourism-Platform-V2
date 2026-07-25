'use client';

import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { PasswordStrengthField } from './password-strength-field';
import { TicketCard } from './ticket-card';

// Ruột form /reset-password (plan Task 4, chỉnh vòng 2) — dùng chung
// PasswordStrengthField với /register (bản 4-vạch-theo-độ-dài cũ đã thay để
// hai trang cùng MỘT chỉ báo độ mạnh). Confirm giữ Input thường.
export function ResetPasswordForm() {
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

        <PasswordStrengthField id="reset-password" label="New password" placeholder="Password" />

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
