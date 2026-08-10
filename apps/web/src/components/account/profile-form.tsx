'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, mapAuthError } from '@/lib/auth-errors';

/** 401 giữa chừng (session hết hạn) có UI RIÊNG — message + link đăng nhập
 *  lại, KHÔNG auto-signout (spec §5) — tách khỏi `mapAuthError` (bản đó map
 *  401 → 'invalidCredentials', đúng cho LOGIN nhưng sai ngữ nghĩa ở đây). */
type ProfileErrorKind = 'sessionExpired' | AuthErrorKey;

/**
 * Form tên/phone (spec §3) — Task 7 (A2): nối
 * `authClient.updateUser({ name, phone })` (`phone` là additionalField
 * `input: true`, xác minh qua `.d.mts`/`apps/api/src/auth/auth.config.ts`,
 * không đoán). Email read-only kèm chú thích riêng (PARK spec §4 — đổi email
 * chưa làm, đừng dựng form ghi cho field này).
 */
export function ProfileForm({ profile }: { profile: SessionUser }) {
  const t = messages.accountProfile.details;
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ProfileErrorKind | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKind(null);
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC error envelope ({error}) ở nhánh dưới (bài học pending-kẹt cụm
    // auth — mọi await đều try/catch, finally nhả pending).
    try {
      const { error } = await authClient.updateUser({ name, phone });
      if (error) {
        setErrorKind(error.status === 401 ? 'sessionExpired' : mapAuthError(error));
        return;
      }
      toast.success(messages.accountProfile.toast.profileSavedTitle);
      router.refresh();
    } catch {
      setErrorKind('generic');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4 rounded-2xl border bg-card p-6" onSubmit={handleSubmit}>
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

      {errorKind ? (
        <AccountActionError
          expired={errorKind === 'sessionExpired'}
          redirectTo="/account/profile"
          // Nhánh null có chủ đích: không bao giờ được dùng (component đã hiện
          // UI riêng khi `expired`), nhưng cần để TypeScript THU HẸP `errorKind`
          // — 'sessionExpired' không phải khoá của `authForms.errors`. Ternary
          // nội tuyến trước đây thu hẹp sẵn; truyền prop thì mất.
          fallback={errorKind === 'sessionExpired' ? null : messages.authForms.errors[errorKind]}
        />
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {t.save}
      </Button>
    </form>
  );
}
