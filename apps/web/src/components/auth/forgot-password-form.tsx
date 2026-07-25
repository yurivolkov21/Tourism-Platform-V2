'use client';

import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useState } from 'react';
import { TicketCard } from './ticket-card';

// Ruột form /forgot-password (plan Task 4) — 1 field email; mock state `sent`
// (useState demo, KHÔNG gọi API): submit đổi thân card thành "Check your inbox"
// + nút gửi lại. Static-first; nợ API reset ghi ở spec.
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

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
              If that address has an account, a reset link is riding over right now. It expires in
              30 minutes.
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
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div>
            <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
              Lost your ticket?
              <span className="text-primary italic"> It happens on the road.</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Tell us your email and we'll send a link to reset your password.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" placeholder="you@example.com" />
          </div>

          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Send the reset link
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
