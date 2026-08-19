import { RevealItem } from '@/components/motion/reveal-item';
import { TourCard } from '@/components/tours/tour-card';
import type { TourCardVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';

/**
 * Gợi ý cuối trang. Danh sách do `relatedTours()` chọn: cùng chuyên mục trước,
 * rồi tour chia chung destination, rồi bù bằng phần còn lại — và không bao giờ
 * chứa chính tour đang xem.
 *
 * KHÔNG port bản Nexora (`pickRelated` = cắt 4 tour đầu, không xét gì): một trang
 * tour Hạ Long gợi ý bốn tour bất kỳ thì không phải gợi ý, chỉ là chỗ trống được
 * lấp. Rỗng thì không render gì — 16 tour mock luôn đủ, nhưng khi gắn API mà
 * catalogue chỉ có 1 tour thì đây là nhánh có thật.
 */
export function RelatedTours({ tours }: { tours: TourCardVM[] }) {
  if (tours.length === 0) return null;

  return (
    // gap-y lớn hơn gap-x: card không có khung nên hai hàng cần khoảng thở dọc
    // rộng hơn để không đọc thành một khối chữ liền.
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((tour, index) => (
        // Ba card liên quan trồi lên bậc thang khi cuộn tới (nhóm motion 1, 19/08)
        // — cùng nhịp lưới Home/Journal; `h-full` để card kéo đều hàng.
        <RevealItem key={tour.slug} enter="rise" delay={index * STAGGER.grid} className="h-full">
          <TourCard tour={tour} />
        </RevealItem>
      ))}
    </div>
  );
}
