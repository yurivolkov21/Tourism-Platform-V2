import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { AccountSection, AccountSections } from '@/components/account/account-section';
import { SavedGrid } from '@/components/account/saved-grid';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — "ngăn kẹp trong hộ chiếu" (spec 2026-08-11, M1/T8):
 * `SavedGrid` GIỮ NGUYÊN toàn bộ logic (optimistic remove + rollback + empty
 * state dạy hành vi), chỉ khoác lại khung: nền giấy bleed + back-link
 * "← Passport" + heading "Tucked inside" — cùng chất liệu ba trang còn lại.
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Tourism`,
  description: messages.accountSaved.subtitle,
  robots: { index: false },
};

export default async function AccountSavedPage() {
  // Chỉ cần GATE (defense-in-depth, `proxy.ts` đã chặn sớm — ADR-0017 §3).
  await requireSession('/account/saved');
  const cookie = (await cookies()).toString();
  const wishlist = await fetchMyWishlist(cookie);

  const t = messages.accountSaved;
  return (
    <div className="relative border-b border-border/55 bg-paper">
      {/* Texture giấy — đồng chất với hộ chiếu/visa/settings. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
      />
      <div className="relative mx-auto max-w-5xl px-4 py-10 md:px-8">
        <Link
          href="/account"
          className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.back}
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold text-balance">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        <div className="mt-2">
          <AccountSections>
            <AccountSection
              title={t.listHeading}
              description={t.blurb}
              meta={t.savedCount(wishlist.length)}
            >
              <SavedGrid initialItems={wishlist} />
            </AccountSection>
          </AccountSections>
        </div>
      </div>
    </div>
  );
}
