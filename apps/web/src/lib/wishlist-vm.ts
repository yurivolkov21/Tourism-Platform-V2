import type { WishlistItem } from '@tourism/contract';
import type { TourCardVM } from '@/lib/api/tours';

/**
 * `WishlistItem` (contract) → `TourCardVM` để TÁI DÙNG `TourCard` (khuôn card
 * catalogue sẵn có — brief Task 3 cấm vẽ card mới). Field mà wishlist KHÔNG
 * mang (`summary`/`compareAtPrice`/`difficulty`/`maxGroupSize`/`isFeatured`/
 * `destinations`/`category`) nhận default TRUNG TÍNH — đã đối chiếu JSDoc
 * `tour-card.tsx`: NĂM field đó (category/maxGroupSize/isFeatured/summary +
 * so sánh giá) cố tình KHÔNG được `TourCard` render, nên default không bao
 * giờ lộ ra màn hình. `destinations: []` là ngoại lệ CÓ hiện (dải chặng rỗng,
 * không dòng nào) — trung thực hơn là tự chế điểm đến không có trong dữ liệu.
 *
 * Đặt ở LIB THUẦN (không phải trong `saved-grid.tsx`) vì `AccountDashboard`
 * (server component, không `'use client'`) cũng cần gọi hàm này để dựng khối
 * "3 tour đã lưu" — Next 16 chặn cứng việc một Server Component gọi thẳng
 * một hàm từ module `'use client'` (đo được khi build production: "Attempted
 * to call wishlistToTourCardVM() from the server but … is on the client").
 */
export function wishlistToTourCardVM(item: WishlistItem): TourCardVM {
  return {
    id: item.tourId,
    slug: item.slug,
    title: item.title,
    summary: null,
    basePrice: item.basePrice,
    compareAtPrice: null,
    currency: item.currency,
    durationDays: item.durationDays,
    difficulty: null,
    maxGroupSize: 1,
    isFeatured: false,
    destinations: [],
    category: { slug: '', name: '' },
    ratingAvg: item.ratingAvg,
    ratingCount: item.ratingCount,
    // `WishlistItemSchema` không mang ảnh, nên null ở đây là TRUNG THỰC chứ
    // không phải thiếu sót của hàm này — cùng lý lẽ với `destinations: []` ở
    // trên. Hệ quả nhìn thấy được: tour trong /account/saved còn ô giữ chỗ
    // trong khi /tours đã có ảnh thật. Vá đúng cách là thêm `cover` vào
    // contract wishlist, không phải bịa ảnh ở tầng VM.
    cover: null,
  };
}
