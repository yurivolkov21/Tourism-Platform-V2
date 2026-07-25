'use client';

import { Checkbox } from '@tourism/ui/components/checkbox';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { GoogleIcon } from '@/components/icons/social';
import { TicketCard } from './ticket-card';

// Ruột form /register (plan Task 3) — nhân từ mẫu login-form: heading accent
// italic, Google, separator, name/email/password, checkbox Terms, submit,
// link về /login. Submit no-op static-first; nợ validate ghi ở spec.
export function RegisterForm() {
  return (
    <TicketCard stub="NEW TRAVELLER · SEAT --/-- · GATE: REGISTER">
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            Claim your seat
            <span className="text-primary italic"> on the next trip.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One account for every valley, coast and city ahead.
          </p>
        </div>

        <button
          type="button"
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-name">Full name</Label>
          <Input id="register-name" type="text" placeholder="Tran Mai Anh" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" type="email" placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-password">Password</Label>
          <Input id="register-password" type="password" placeholder="At least 8 characters" />
        </div>

        <label
          htmlFor="register-terms"
          className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground"
        >
          <Checkbox id="register-terms" className="mt-0.5" />
          <span>
            I agree to the{' '}
            <a href="/terms" className="font-medium text-primary hover:underline">
              Terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create my account
        </button>

        {/* Note register→verify (plan Task 6): báo trước bước soát vé email */}
        <p className="text-center text-xs text-muted-foreground">
          We'll mail you a six-digit code to confirm this address.
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Already have a ticket?{' '}
          <a href="/login" className="font-medium text-primary hover:underline">
            Log in
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
