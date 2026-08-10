'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { HeartIcon } from 'lucide-react';
import { useWishlist } from '@/components/tours/wishlist-store';

/**
 * Nút tim trên card tour.
 *
 * Tự ẩn khi không có `WishlistProvider` bao ngoài. Đây là điểm mấu chốt: trước
 * cụm này, `tour-list-card.tsx` ship một cái tim BẤM ĐƯỢC nhưng hoàn toàn trơ —
 * không `onClick`, file còn không phải client component — trong khi `aria-label`
 * vẫn nói "Save … to wishlist". Trình đọc màn hình quảng cáo một chức năng
 * không tồn tại, đúng điều mà chính repo đã tự cấm ở `tour-card.tsx`: "một cái
 * tim không làm gì là hứa thứ sản phẩm không giữ".
 *
 * Nên luật ở đây: có nguồn trạng thái thì hiện tim thật, không có thì KHÔNG
 * hiện gì cả.
 */
export function WishlistHeart({ tourId, tourTitle }: { tourId: string; tourTitle: string }) {
  const wishlist = useWishlist();
  if (!wishlist) return null;

  const wished = wishlist.isWished(tourId);
  const t = messages.toursPage;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      // `aria-pressed` chứ không đổi nhãn theo trạng thái: đây là nút BẬT/TẮT,
      // và trình đọc màn hình đọc trạng thái nén sẵn — đổi nhãn qua lại làm
      // người dùng tưởng đó là hai nút khác nhau.
      aria-pressed={wished}
      aria-label={t.wishlistLabel(tourTitle)}
      onClick={() => wishlist.toggle(tourId)}
    >
      <HeartIcon className={wished ? 'fill-current text-primary' : undefined} />
    </Button>
  );
}
