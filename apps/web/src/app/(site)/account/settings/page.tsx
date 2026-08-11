import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  AccountRow,
  AccountRows,
  AccountSection,
  AccountSections,
} from '@/components/account/account-section';
import { DeleteAccount } from '@/components/account/delete-account';
import { ProfileSummary } from '@/components/account/profile-summary';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/settings` — tầng sau của hộ chiếu (spec 2026-08-11, M3): nội dung
 * profile cũ DI CƯ NGUYÊN KHỐI (ProfileSummary nở-inline + connected accounts
 * + DeleteAccount cuối trang — logic không đổi một dòng), chỉ khoác lại khung:
 * nền giấy bleed, back-link "← Passport", heading serif mới. `/account/profile`
 * và `/account/security` redirect vĩnh viễn về đây.
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
    <div className="relative border-b border-border/55 bg-paper">
      {/* Cùng texture giấy với trang hộ chiếu — hai tầng phải cùng chất liệu. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 py-10 md:px-8">
        <Link
          href="/account"
          className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {tp.back}
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold text-balance">{tp.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tp.subtitle}</p>

        <div className="mt-2">
          <AccountSections>
            <AccountSection title={t.details.heading} description={t.details.blurb}>
              <ProfileSummary profile={profile} />
            </AccountSection>

            <AccountSection title={t.connected.heading} description={t.connected.subtitle}>
              {/* Chỉ email/password (không có OAuth demo trong seed dev) — giữ
                  nguyên từ trang profile cũ. */}
              <AccountRows>
                <AccountRow label={t.connected.emailPassword}>
                  <span className="text-muted-foreground">{profile.email}</span>
                </AccountRow>
              </AccountRows>
            </AccountSection>
          </AccountSections>
        </div>

        {/* Xoá tài khoản đứng CUỐI, NGOÀI mọi section — giữ nguyên quyết định
            Task 8 cụm trước; component tự lo heading/mô tả/ngăn cách. */}
        <DeleteAccount />
      </div>
    </div>
  );
}
