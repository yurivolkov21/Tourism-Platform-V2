import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { DeleteAccount } from '@/components/account/delete-account';
import { ProfileSummary } from '@/components/account/profile-summary';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/settings` — tầng sau của hộ chiếu (spec 2026-08-11, M3; dựng lại
 * MỘT CỘT theo góp ý user 11/08: bỏ lưới hai-cột + card trắng của
 * `AccountSection` — heading serif đứng TRÊN nhóm, rows in thẳng lên giấy,
 * mọi thứ chung một mép trái). Logic (`ProfileSummary` nở-inline,
 * `DeleteAccount` dialog) không đổi một dòng; nền giấy + texture nằm ở layout.
 */
export const metadata: Metadata = {
  title: `${messages.passportSettings.title} — Tourism`,
  description: messages.passportSettings.subtitle,
  robots: { index: false },
};

export default async function AccountSettingsPage() {
  await requireSession('/account/settings');
  const cookie = (await cookies()).toString();
  const profile = await fetchAccountMe(cookie);

  const t = messages.accountProfile;
  const tp = messages.passportSettings;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <Link
        href="/account"
        className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {tp.back}
      </Link>
      <h1 className="mt-3 font-heading text-2xl font-semibold text-balance">{tp.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{tp.subtitle}</p>

      <section className="mt-10">
        <h2 className="font-heading text-lg font-semibold">{t.details.heading}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.details.blurb}</p>
        <div className="mt-3">
          <ProfileSummary profile={profile} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg font-semibold">{t.connected.heading}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.connected.subtitle}</p>
        {/* Một dòng duy nhất (email/password — seed dev không có OAuth), cùng
            khuôn dòng với ProfileSummary để chung nhịp divider. */}
        <div className="mt-3 flex items-baseline justify-between gap-6 border-t border-border/55 py-4">
          <span className="text-sm font-medium text-foreground">{t.connected.emailPassword}</span>
          <span className="truncate text-sm text-muted-foreground">{profile.email}</span>
        </div>
      </section>

      {/* Xoá tài khoản đứng CUỐI — component tự lo heading/mô tả/ngăn cách. */}
      <DeleteAccount />
    </div>
  );
}
