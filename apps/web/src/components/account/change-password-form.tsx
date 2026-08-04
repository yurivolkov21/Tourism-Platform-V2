'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useState } from 'react';

/**
 * Đổi mật khẩu (spec §3) — A1: state cục bộ, submit chỉ `preventDefault()`,
 * KHÔNG gọi API — Task 7 (A2) mới nối `authClient.changePassword({...})`
 * (xác minh tên method/field qua `.d.mts` lúc thi công đó, không đoán).
 */
export function ChangePasswordForm() {
  const t = messages.accountProfile.password;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="font-heading text-lg font-medium text-foreground">{t.heading}</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-new-password">{t.newLabel}</Label>
        <Input
          id="profile-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-confirm-password">{t.confirmLabel}</Label>
        <Input
          id="profile-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <Button type="submit" className="self-start">
        {t.submit}
      </Button>
    </form>
  );
}
