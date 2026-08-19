import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { SavedGrid } from '@/components/account/saved-grid';
import { ContentHero } from '@/components/content/content-hero';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — "ngăn kẹp trong hộ chiếu" (spec 2026-08-11; dựng lại MỘT
 * CỘT theo góp ý user 11/08: bỏ lưới hai-cột `AccountSection`, heading đứng
 * trên, lưới in thẳng lên giấy). `SavedGrid` giữ nguyên logic; nền giấy +
 * texture nằm ở layout khu.
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Nexora`,
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
    <div>
      {/* Hero chuẩn site (vòng góp ý 11/08) — title/subtitle ở hero, meta là
          số tour đã lưu; thân trang không lặp heading. */}
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={t.title}
        subtitle={t.subtitle}
        meta={t.savedCount(wishlist.length)}
      />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <Link
          href="/account"
          className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.back}
        </Link>
        <div className="mt-6">
          <SavedGrid initialItems={wishlist} />
        </div>
      </div>
    </div>
  );
}
