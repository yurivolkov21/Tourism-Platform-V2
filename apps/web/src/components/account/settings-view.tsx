import { messages } from '@tourism/i18n';
import { DeleteAccount } from '@/components/account/delete-account';
import { IdentityCard } from '@/components/account/identity-card';
import { PasswordCard } from '@/components/account/password-card';
import { ProfileSummary } from '@/components/account/profile-summary';
import { ContentHero } from '@/components/content/content-hero';
import type { SessionUser } from '@/lib/api/session';

/**
 * Thân trang `/account/settings` (spec 09/10 §2, phương án C) — tách khỏi `page.tsx` để test
 * được: Vitest của web không quét `src/app/**` (nếp `BookingsListView`). Trang lo phiên và đọc
 * hồ sơ; component này lo mọi thứ khách thấy, kể cả hero.
 *
 * - Hero giữ chữ cũ, thêm nút tròn quay lại Passport (`ContentHero.back`) thay link chữ
 *   "← Passport" — cùng khoá nhãn với My bookings và Saved.
 * - Từ `lg`: hai cột, trái 20rem (320px) là thẻ danh tính DÍNH khi cuộn (`lg:top-28`, cùng mốc
 *   với rail đặt tour), phải là Personal information → Password → Danger zone; khung rộng tối đa
 *   1024px giữa trang. `lg:items-start` để ô lưới không giãn cao bằng cột phải — giãn thì
 *   `sticky` không còn chỗ trượt.
 * - Dưới `lg`: một cột, thẻ danh tính lên đầu và không dính; lề 16px.
 */
export function SettingsView({ profile }: { profile: SessionUser }) {
  const tp = messages.passportSettings;
  return (
    <div>
      <ContentHero
        breadcrumb={tp.heroBreadcrumb}
        title={tp.title}
        subtitle={tp.subtitle}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="px-4 pt-10 pb-16 md:pb-20 lg:px-8">
        <div
          data-slot="settings-layout"
          className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6"
        >
          <IdentityCard profile={profile} className="lg:sticky lg:top-28" />
          <div className="flex min-w-0 flex-col gap-5">
            <ProfileSummary profile={profile} />
            <PasswordCard />
            <DeleteAccount />
          </div>
        </div>
      </div>
    </div>
  );
}
