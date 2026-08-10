'use client';

import { ORPCError } from '@orpc/client';
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { api, withBrowserAuth } from '@/lib/api/client';
import { formatMoney } from '@/lib/tours';

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
 * Card cho MỘT tour đã lưu.
 *
 * Vì sao không tái dùng `TourCard`: `WishlistItemSchema` chỉ mang tiêu đề,
 * giá, số ngày và rating. Muốn nhét nó vào `TourCardVM` thì phải BỊA những
 * field còn lại — trước đây `wishlistToTourCardVM` điền `category: {slug:'',
 * name:''}`, `maxGroupSize: 1`, `isFeatured: false`. Hiện tại `TourCard` tình
 * cờ không render ba field đó nên chưa ai thấy, nhưng nó là một quả mìn hẹn
 * giờ: ngày nào `TourCard` bắt đầu hiện category, mọi tour đã lưu sẽ mọc ra
 * một chip rỗng.
 *
 * Card riêng thì không có gì để bịa — nó chỉ dựng được đúng thứ dữ liệu có.
 */
function SavedTourCard({ item, onRemove }: { item: WishlistItem; onRemove: () => void }) {
  const t = messages.accountSaved;
  const tc = messages.toursPage;

  return (
    <div className="group relative flex flex-col gap-2.5">
      <div className="overflow-hidden rounded-xl">
        <ImagePlaceholder className="aspect-16/10 w-full" />
      </div>
      <h3 className="min-h-[2lh] overflow-hidden font-heading text-lg leading-snug font-medium text-foreground transition-colors group-hover:text-primary-emphasis [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
        {/* Cả card là MỘT vùng bấm qua `after:inset-0`, cùng thủ thuật TourCard
            dùng — nút bỏ lưu nằm trên nhờ `z-10`. */}
        <a href={`/tours/${item.slug}`} className="after:absolute after:inset-0">
          {item.title}
        </a>
      </h3>
      <p className="text-sm text-muted-foreground">{tc.durationValue(item.durationDays)}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-heading text-lg font-semibold tabular-nums text-foreground">
          {formatMoney(item.basePrice, item.currency)}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {item.ratingAvg === null ? tc.notRated : `★ ${item.ratingAvg} (${item.ratingCount})`}
        </span>
      </div>
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
 * nhận đủ, xem spec §5).
 *
 * 401 giữa chừng có thông báo RIÊNG kèm link đăng nhập lại — trước đây mọi
 * lỗi đều rơi vào cùng một toast "không bỏ lưu được", tức khách hết phiên bị
 * bảo là thao tác hỏng thay vì được bảo phải đăng nhập lại. Đây là component
 * duy nhất trong khu account còn thiếu nhánh đó.
 */
export function SavedGrid({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [expired, setExpired] = useState(false);
  const t = messages.accountSaved;

  async function handleRemove(tourId: string) {
    const index = items.findIndex((item) => item.tourId === tourId);
    if (index === -1) return;
    const removed = items[index] as WishlistItem;
    setItems((current) => current.filter((item) => item.tourId !== tourId));
    try {
      await api.wishlist.set({ tourId, wished: false }, { context: withBrowserAuth() });
    } catch (error) {
      // Rollback ĐÚNG vị trí cũ (splice), không phải push cuối mảng — tránh
      // thứ tự "mới nhất trước" (server) nhảy lộn xộn chỉ vì một request lỗi.
      setItems((current) => {
        const next = [...current];
        next.splice(index, 0, removed);
        return next;
      });
      // Hết phiên là chuyện KHÁC hẳn "thao tác hỏng": khách cần biết phải đăng
      // nhập lại, không phải thử bấm lại. Toast biến mất sau vài giây nên
      // thông tin đó phải nằm lại trên trang.
      if (error instanceof ORPCError && error.status === 401) {
        setExpired(true);
        return;
      }
      toast.error(t.removeErrorToast.title, { description: t.removeErrorToast.body });
    }
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {expired ? (
        <AccountActionError expired redirectTo="/account/saved" fallback={null} className="mb-4" />
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) =>
          item.unavailable ? (
            <UnavailableCard
              key={item.tourId}
              item={item}
              onRemove={() => handleRemove(item.tourId)}
            />
          ) : (
            <SavedTourCard
              key={item.tourId}
              item={item}
              onRemove={() => handleRemove(item.tourId)}
            />
          ),
        )}
      </div>
    </>
  );
}
