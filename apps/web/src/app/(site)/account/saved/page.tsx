import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { SavedGrid } from '@/components/account/saved-grid';
import { MOCK_WISHLIST } from '@/mocks/account';

/**
 * `/account/saved` — grid tour đã lưu (spec §3, pha A1 TĨNH). Đọc trực tiếp
 * `MOCK_WISHLIST`, KHÔNG gọi `wishlist.list` — Task 6 (A2) thay bằng fetch
 * thật rồi truyền `initialItems`, `SavedGrid` không đổi (optimistic remove
 * vẫn là state cục bộ; A2/Task 7 mới nối `wishlist.set` phía dưới hành động
 * ✕ và rollback khi lỗi).
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Tourism`,
  description: messages.accountSaved.subtitle,
  robots: { index: false },
};

export default function AccountSavedPage() {
  const t = messages.accountSaved;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </div>
      <SavedGrid initialItems={MOCK_WISHLIST} />
    </div>
  );
}
