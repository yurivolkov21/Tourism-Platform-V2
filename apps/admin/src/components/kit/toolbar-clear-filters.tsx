'use client';

import { Button } from '@tourism/ui/components/button';
import { BrushCleaningIcon } from 'lucide-react';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';

/**
 * MỘT nút xoá cho cả hàng điều khiển bảng admin (user chốt 05/09 qua bản demo
 * `docs/design/mockups/admin-toolbar-sizing.src.html`).
 *
 * Trước đó mỗi bộ lọc tự mang nút xoá của nó: `TableSearchForm` có "Clear",
 * `ToolbarDateRange` có "Clear dates". Đang lọc cả hai thì hàng mọc ra hai nút
 * xoá cạnh nhau, và muốn về trạng thái sạch phải bấm hai lần.
 *
 * ## Nó xoá tới đâu
 *
 * **Mọi bộ lọc ở khe `actions`, KHÔNG đụng khe `views`.** Dải tab trạng thái
 * nằm ở `views` là một thứ khác hẳn: nó tự đã có mục "All" ngay trên màn hình,
 * và sidebar link thẳng vào những URL như `/reviews?status=pending`. Một nút ở
 * mép phải mà lặng lẽ đổi luôn dải tab bên trái là thứ không ai đoán được.
 *
 * ## Vì sao nhận `href` chứ không nhận danh sách field
 *
 * Mỗi vùng có một tập bộ lọc khác nhau (bookings có ngày, outbox có loại
 * email, payment-events có công tắc Unprocessed…) và một hàm `*Href` riêng
 * biết cách viết chúng ra URL. Kit mà tự dựng patch thì phải biết bảy hình
 * dạng query — nó sẽ thành nơi mọi vùng rò rỉ vào.
 *
 * `href === null` nghĩa là **không có gì để xoá**, và nút không render. Cách
 * vùng tính ra `null` là so href-đã-xoá với href-hiện-tại, cả hai GHIM
 * `page: 1` — đúng mẹo mà `ToolbarDateRange.go()` đã trả giá hai vòng review
 * để tìm ra: không ghim trang thì từ trang 2 trở đi hai chuỗi khác nhau CHỈ
 * VÌ `page`, và phép so luôn nói "có gì đó để xoá".
 *
 * `/bookings` là NGOẠI LỆ có chủ đích, và nút KHÔNG tự ẩn ở đó: trang ấy độn
 * sẵn tháng hiện tại vào URL trần, nên href-đã-xoá là `?dates=all` và luôn
 * khác href-hiện-tại. Đó là đúng ý — `?dates=all` là đường DUY NHẤT về "xem
 * tất cả" (spec polish 2) — nhưng lúc chỉ còn tháng mặc định thì nút phải
 * ĐỔI NHÃN thành "show all dates" chứ không được nói "clear filters" cho một
 * việc làm bảng RỘNG ra (vùng tự chọn nhãn; vòng vá review 05/09 — bản đầu
 * của JSDoc này khẳng định nút tự ẩn, sai).
 */
export function ToolbarClearFilters({
  label,
  href,
  onNavigate,
}: {
  label: string;
  /** Href sau khi xoá sạch; `null` = hàng điều khiển đang sạch rồi. */
  href: string | null;
  /** Điều hướng thật. Vùng truyền `router.push` xuống. */
  onNavigate: (href: string) => void;
}) {
  if (href === null) return null;

  return (
    <Button
      type="button"
      // `destructive` của `@tourism/ui` CHÍNH LÀ đỏ NHẠT —
      // `bg-destructive/10 text-destructive-emphasis hover:bg-destructive/20`
      // (xem `decision-button.tsx`). Không phải nút đỏ đặc: nút to tiếng nhất
      // admin đang có là *Deny* — từ chối một yêu cầu hoàn tiền — và nó cũng
      // chỉ dùng mức nhạt này. Xoá vài bộ lọc thì không được phép gắt hơn một
      // quyết định về tiền.
      variant="destructive"
      className={TOOLBAR_BUTTON}
      onClick={() => onNavigate(href)}
    >
      <BrushCleaningIcon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  );
}

/**
 * "Có gì để xoá không" → href hoặc `null`.
 *
 * Ở kit chứ không chép vào bảy vùng: phép so này trông tầm thường nhưng chỗ
 * sai của nó thì không (xem ghi chú `page: 1` ở trên), và bảy bản chép là bảy
 * cơ hội để một vùng quên ghim trang.
 */
export function clearFiltersHref(clearedHref: string, currentHref: string): string | null {
  return clearedHref === currentHref ? null : clearedHref;
}
