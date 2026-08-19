import { TopoPattern } from '@/components/topo-pattern';
import { TourHero } from '@/components/tours/tour-hero';
import type { TourDetailVM } from '@/lib/api/tours';

/**
 * Nền tối cho `TourHero` — dùng ở `/tours/[slug]/book` và `/tours/[slug]/enquire`
 * (thêm 19/08, user chốt).
 *
 * `TourHero` CỐ Ý không tự mang nền: ở trang chi tiết, `bg-hero` và lớp vân nằm
 * một bậc cao hơn (`TourBoard` trong `page.tsx`) để nền liên tục qua vạch chia
 * giữa hero và phần dưới. Hai trang checkout không có phần dưới đó nên cần một
 * bọc riêng — gói vào đây thay vì chép ba dòng vào hai file, vì cái bọc này
 * mang theo một cái bẫy phải nhớ (xem dưới).
 *
 * **`bg-hero` phải nằm NGOÀI mọi scope `dark`.** Đặt nó bên trong thì ở dark
 * mode band trùng màu nền trang và hero biến mất — lỗi đã sửa ở `22bd75e` cho
 * trang chi tiết, và nó sẽ tái diễn y hệt ở đây nếu ai đó gộp `dark` lên thẻ
 * này. `TourHero` tự bọc `dark contents` cho phần NỘI DUNG của nó.
 *
 * Vì sao hai trang này cần hero: navbar lúc chưa cuộn dùng chữ sáng vì giả định
 * đứng trên hero tối. Trước 19/08, `site-header.tsx` phải dò đường dẫn để loại
 * trừ `/book` — một luật đi theo đường dẫn, và nó đã rách ngay khi `/enquire`
 * ra đời (navbar tàng hình ở light mode, đo được: chữ `lab(97.7…)` trên nền
 * sáng). Cho hai trang một hero thật thì luật navbar về lại đồng nhất và đoạn
 * dò đường dẫn được xoá hẳn.
 */
export function TourHeroBoard({ tour }: { tour: TourDetailVM }) {
  return (
    <div className="relative overflow-hidden bg-hero text-hero-foreground">
      <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />
      <TourHero tour={tour} />
    </div>
  );
}
