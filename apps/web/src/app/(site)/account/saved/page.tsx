import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SavedGrid } from '@/components/account/saved-grid';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — grid tour đã lưu (spec §3, Task 6/A2: `wishlist.list`
 * thật thay mock nội bộ cụm đã khai tử). `SavedGrid` không đổi (optimistic remove vẫn
 * là state cục bộ; Task 7 mới nối `wishlist.set` phía dưới hành động ✕ và
 * rollback khi lỗi).
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Tourism`,
  description: messages.accountSaved.subtitle,
  robots: { index: false },
};

export default async function AccountSavedPage() {
  // Chỉ cần GATE (defense-in-depth, `proxy.ts` đã chặn sớm — ADR-0017 §3) —
  // trang này không hiện tên/hồ sơ nên không giữ lại giá trị trả về.
  await requireSession('/account/saved');
  const cookie = (await cookies()).toString();
  const wishlist = await fetchMyWishlist(cookie);

  const t = messages.accountSaved;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </div>
      <SavedGrid initialItems={wishlist} />
    </div>
  );
}
