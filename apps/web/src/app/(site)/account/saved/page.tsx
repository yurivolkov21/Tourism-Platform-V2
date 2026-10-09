import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SavedView } from '@/components/account/saved-view';
import { todayDateString } from '@/lib/account-stats';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — tour đã lưu (spec 09/10 §3, phương án A). Trang chỉ gác phiên và đọc
 * wishlist; hero và lưới nằm ở `SavedView`. `today` (ngày lịch Việt Nam) tính ở server để thẻ in
 * "Saved {ngày}" không phụ thuộc đồng hồ trình duyệt.
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Nexora`,
  description: messages.accountSaved.subtitle,
};

export default async function AccountSavedPage() {
  // Chỉ cần GATE (defense-in-depth, `proxy.ts` đã chặn sớm — ADR-0017 §3).
  await requireSession('/account/saved');
  const cookie = (await cookies()).toString();
  const wishlist = await fetchMyWishlist(cookie);
  return <SavedView items={wishlist} today={todayDateString()} />;
}
