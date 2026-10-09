import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { SavedGrid } from '@/components/account/saved-grid';
import { ContentHero } from '@/components/content/content-hero';

/**
 * Thân trang `/account/saved` (spec 09/10 §1, §3) — tách khỏi `page.tsx` để test được: Vitest
 * của web không quét `src/app/**` (nếp `BookingsListView`). Trang lo phiên và đọc wishlist;
 * component này lo hero và lưới.
 *
 * - Hero giữ chữ cũ; `meta` là số tour đã lưu. Bỏ lưu thành công thì `SavedGrid` gọi
 *   `router.refresh()`: trang dựng lại ở server, component này nhận danh sách mới nên hero đếm
 *   lại, còn lưới giữ state của nó.
 * - Nút tròn quay lại Passport (`ContentHero.back`) thay link chữ "← Passport" cũ — cùng khoá
 *   nhãn với My bookings.
 * - Khung rộng tối đa 1152px; lề 16px dưới `lg`, 32px từ `lg`.
 */
export function SavedView({
  items,
  today,
}: {
  items: WishlistItem[];
  /** Ngày lịch Việt Nam do server tính (`todayDateString`). */
  today: string;
}) {
  const t = messages.accountSaved;
  return (
    <div>
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={t.title}
        subtitle={t.subtitle}
        meta={t.savedCount(items.length)}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="px-4 pt-10 pb-16 md:pb-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SavedGrid initialItems={items} today={today} />
        </div>
      </div>
    </div>
  );
}
