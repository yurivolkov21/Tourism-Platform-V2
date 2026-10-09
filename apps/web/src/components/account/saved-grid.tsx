'use client';

import { ORPCError } from '@orpc/client';
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { SavedTourCard } from '@/components/account/saved-tour-card';
import { RevealItem } from '@/components/motion/reveal-item';
import { api, withBrowserAuth } from '@/lib/api/client';
import { STAGGER } from '@/lib/motion';

/**
 * Hướng A: bỏ khung hộp (`border`/`bg-card`) — trước đây nhốt copy dạy-hành-vi
 * trong một hộp trông như thông báo lỗi. Giờ chỉ căn giữa, khoảng trắng rộng
 * tự làm việc, cùng nhịp "không hộp" với empty-state Trips.
 */
function EmptyState() {
  const t = messages.accountSaved.emptyState;
  return (
    <div className="py-16 text-center">
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
 * Lưới `/account/saved` (spec 09/10 §3, phương án A): 1 cột dưới `sm`, 2 cột từ `sm`, 3 cột từ
 * `lg`; khe ngang 24px, dọc 32px. Mỗi ô là một `SavedTourCard` (tim nổi trên ảnh).
 *
 * Bấm tim → xoá OPTIMISTIC khỏi mảng rồi mới gọi `wishlist.set({ tourId, wished: false })`
 * (idempotent, cùng route nút tim ở `/tours` dùng để lưu). Lỗi → chèn lại ĐÚNG vị trí cũ (không
 * đẩy xuống cuối) + toast lỗi; KHÔNG toast khi thành công — thẻ rời lưới đã là xác nhận đủ.
 *
 * 401 giữa chừng có thông báo RIÊNG kèm link đăng nhập lại: toast biến mất sau vài giây, còn tin
 * "phải đăng nhập lại" phải nằm lại trên trang. 429 có câu "chờ một phút" riêng.
 *
 * `today` là ngày lịch Việt Nam do server tính, truyền xuống thẻ để in "Saved {ngày}".
 */
export function SavedGrid({
  initialItems,
  today,
}: {
  initialItems: WishlistItem[];
  today: string;
}) {
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
      // nhập lại, không phải thử bấm lại.
      if (error instanceof ORPCError && error.status === 401) {
        setExpired(true);
        return;
      }
      if (error instanceof ORPCError && error.status === 429) {
        toast.error(messages.accountActionErrors.throttle);
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
      <div
        data-slot="saved-grid"
        className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((item, index) => (
          // Thẻ đã lưu trồi lên bậc thang — cùng nhịp lưới /tours (nhóm motion 3, 19/08).
          <RevealItem
            key={item.tourId}
            enter="rise"
            delay={Math.min(index, 5) * STAGGER.grid}
            className="h-full"
          >
            <SavedTourCard item={item} today={today} onRemove={() => handleRemove(item.tourId)} />
          </RevealItem>
        ))}
      </div>
    </>
  );
}
