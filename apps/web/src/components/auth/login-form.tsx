'use client';

import { Checkbox } from '@tourism/ui/components/checkbox';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { GoogleIcon } from '@/components/icons/social';
import { TicketCard } from './ticket-card';

// Ruột form /login (Task 2 — trang MẪU của cụm auth): heading accent italic,
// nút Google (UI trước — social backend là nợ phase auth), separator chữ,
// email + password, remember + forgot, submit full-width, link register.
// Submit no-op static-first; nợ validate/honeypot/rate-limit ghi ở spec.
export function LoginForm() {
  return (
    <TicketCard stub="HN → SAPA · SEAT 07/12 · GATE: LOGIN">
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1 className="font-heading text-2xl font-medium text-card-foreground md:text-3xl">
            Welcome back
            <span className="text-primary italic"> to the road.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Log in to pick up where the map left off.
          </p>
        </div>

        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </button>

        {/* Separator chữ giữa hai lối đăng nhập */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          or continue with email
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input id="login-password" type="password" placeholder="••••••••" />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label
            htmlFor="login-remember"
            className="flex cursor-pointer items-center gap-2 text-muted-foreground"
          >
            <Checkbox id="login-remember" />
            Remember me
          </label>
          <a href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Board the trip
        </button>

        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <a href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </a>
        </p>
      </form>
    </TicketCard>
  );
}
