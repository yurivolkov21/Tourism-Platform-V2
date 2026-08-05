'use client';

import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TourCard } from '@/components/tours/tour-card';
import { api, withBrowserAuth } from '@/lib/api/client';
import { wishlistToTourCardVM } from '@/lib/wishlist-vm';

const REMOVE_BUTTON_CLASS =
  'absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background';

function EmptyState() {
  const t = messages.accountSaved.emptyState;
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink href="/tours" className="mt-6">
        {t.cta}
      </ButtonLink>
    </div>
  );
}

/**
 * Tour đã unpublish sau khi khách lưu (`item.unavailable`) — KHÔNG dùng
 * `TourCard` cho nhánh này: `TourCard` luôn là MỘT link thật tới
 * `/tours/[slug]` (bất biến đo ở `tour-card.spec.tsx`), mà tour đã gỡ thì
 * đích đó không còn tồn tại — bắt khách bấm vào một link chết còn tệ hơn một
 * card không bấm được. Vẫn giữ nhịp hình khối gần giống TourCard (ảnh + tiêu
 * đề) để không lệch hẳn khỏi các card khác trong lưới, chỉ mờ đi + đổi nhãn.
 *
 * Export để dùng lại ở khối "3 saved" trên dashboard (account-dashboard.tsx)
 * — CÙNG một nguồn rẽ nhánh unavailable, tránh copy-paste. `onRemove` để
 * OPTIONAL vì dashboard chỉ là bản xem trước, không có nút bỏ lưu (đó là
 * việc của trang /account/saved).
 */
export function UnavailableCard({ item, onRemove }: { item: WishlistItem; onRemove?: () => void }) {
  const t = messages.accountSaved;
  return (
    <div className="relative flex flex-col gap-2.5 opacity-60">
      <div className="relative overflow-hidden rounded-xl">
        <ImagePlaceholder className="aspect-16/10 w-full" />
        <span className="absolute top-2.5 left-2.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {t.unavailable}
        </span>
      </div>
      <h3 className="min-h-[2lh] font-heading text-lg leading-snug font-medium text-muted-foreground">
        {item.title}
      </h3>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t.removeAria(item.title)}
          onClick={onRemove}
          className={REMOVE_BUTTON_CLASS}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Grid `/account/saved` (spec §3) — bấm ✕ xoá OPTIMISTIC ngay khỏi mảng rồi
 * mới gọi `wishlist.set({tourId, wished:false})` (Task 7/A2 — idempotent,
 * cùng route nút tim CỤM B dùng để lưu). Lỗi → rollback (chèn lại item ở
 * ĐÚNG vị trí cũ, không phải đẩy xuống cuối) + toast lỗi — KHÔNG toast khi
 * thành công (khác các form khác trong khu account: card biến mất đã là xác
 * nhận đủ, xem spec §5). Cũng dùng làm khối "3 tour đã lưu" trên dashboard
 * qua `wishlistToTourCardVM` xuất riêng ở trên.
 */
export function SavedGrid({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const t = messages.accountSaved;

  async function handleRemove(tourId: string) {
    const index = items.findIndex((item) => item.tourId === tourId);
    if (index === -1) return;
    const removed = items[index] as WishlistItem;
    setItems((current) => current.filter((item) => item.tourId !== tourId));
    try {
      await api.wishlist.set({ tourId, wished: false }, { context: withBrowserAuth() });
    } catch {
      // Rollback ĐÚNG vị trí cũ (splice), không phải push cuối mảng — tránh
      // thứ tự "mới nhất trước" (server) nhảy lộn xộn chỉ vì một request lỗi.
      setItems((current) => {
        const next = [...current];
        next.splice(index, 0, removed);
        return next;
      });
      toast.error(t.removeErrorToast.title, { description: t.removeErrorToast.body });
    }
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) =>
        item.unavailable ? (
          <UnavailableCard
            key={item.tourId}
            item={item}
            onRemove={() => handleRemove(item.tourId)}
          />
        ) : (
          <div key={item.tourId} className="relative">
            <TourCard tour={wishlistToTourCardVM(item)} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t.removeAria(item.title)}
              onClick={() => handleRemove(item.tourId)}
              className={REMOVE_BUTTON_CLASS}
            >
              <XIcon />
            </Button>
          </div>
        ),
      )}
    </div>
  );
}
