import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { DangerZone } from '@/components/account/danger-zone';
import { ProfileForm } from '@/components/account/profile-form';
import { MOCK_PROFILE } from '@/mocks/account';

/**
 * `/account/profile` — hợp nhất tên/phone + đổi mật khẩu + connected
 * accounts + danger-zone (spec §3, pha A1 TĨNH). Đọc trực tiếp
 * `MOCK_PROFILE`, KHÔNG gọi `GET /api/account/me` — Task 6 (A2) thay bằng
 * session thật. Avatar chữ-cái tĩnh + email read-only (PARK spec §4 —
 * upload avatar/đổi email chưa làm, có hồ sơ lý do trong spec).
 */
export const metadata: Metadata = {
  title: `${messages.accountProfile.title} — Tourism`,
  description: messages.accountProfile.subtitle,
  robots: { index: false },
};

export default function AccountProfilePage() {
  const t = messages.accountProfile;
  const profile = MOCK_PROFILE;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1.5">
          {/* Avatar chữ-cái ĐẦU tên — cùng quy ước `charAt(0)` đã dùng ở
              `user-menu.tsx`/`testimonials.tsx`, không tự chế initials hai
              chữ mới cho riêng trang này. */}
          <Avatar size="lg">
            <AvatarFallback className="text-lg font-medium">
              {profile.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <p className="max-w-28 text-center text-xs text-muted-foreground">{t.avatarHint}</p>
        </div>
        <div>
          <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <ProfileForm profile={profile} />
      <ChangePasswordForm />

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-lg font-medium text-foreground">{t.connected.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.connected.subtitle}</p>
        {/* Mock chỉ có email/password (không có OAuth demo) — A2 (Task 6)
            đọc danh sách provider thật từ session/Better Auth, có thể nhiều
            dòng hơn một. */}
        <ul className="mt-4 flex flex-col gap-2">
          <li className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
            <span className="text-foreground">{t.connected.emailPassword}</span>
            <span className="text-muted-foreground">{profile.email}</span>
          </li>
        </ul>
      </section>

      <DangerZone />
    </div>
  );
}
