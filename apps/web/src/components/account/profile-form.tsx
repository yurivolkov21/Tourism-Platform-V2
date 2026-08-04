'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useState } from 'react';
import type { SessionUser } from '@/lib/api/session';

/**
 * Form tên/phone (spec §3) — A1: state cục bộ khởi tạo từ `profile`, submit
 * chỉ `preventDefault()` (tránh native reload khi bấm Save), KHÔNG gọi API
 * — Task 7 (A2) mới nối `authClient.updateUser({ name, phone })`. Email
 * read-only kèm chú thích riêng (PARK spec §4 — đổi email chưa làm, đừng
 * dựng form ghi cho field này).
 */
export function ProfileForm({ profile }: { profile: SessionUser }) {
  const t = messages.accountProfile.details;
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="font-heading text-lg font-medium text-foreground">{t.heading}</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">{t.nameLabel}</Label>
        <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-phone">{t.phoneLabel}</Label>
        <Input
          id="profile-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">{t.emailLabel}</Label>
        <Input id="profile-email" value={profile.email} disabled readOnly />
        <p className="text-sm text-muted-foreground">{t.emailHint}</p>
      </div>

      <Button type="submit" className="self-start">
        {t.save}
      </Button>
    </form>
  );
}
