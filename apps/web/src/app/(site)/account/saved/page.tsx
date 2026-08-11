import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { SavedGrid } from '@/components/account/saved-grid';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — "ngăn kẹp trong hộ chiếu" (spec 2026-08-11; dựng lại MỘT
 * CỘT theo góp ý user 11/08: bỏ lưới hai-cột `AccountSection`, heading đứng
 * trên, lưới in thẳng lên giấy). `SavedGrid` giữ nguyên logic; nền giấy +
 * texture nằm ở layout khu.
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
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Link
        href="/account"
        className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {t.back}
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-balance">{t.title}</h1>
        <span className="text-sm text-muted-foreground">{t.savedCount(wishlist.length)}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      <div className="mt-6">
        <SavedGrid initialItems={wishlist} />
      </div>
    </div>
  );
}
