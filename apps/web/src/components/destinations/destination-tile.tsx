import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowRightIcon } from 'lucide-react';
import { SlotImage } from '@/components/slot-image';
import type { DestinationVM } from '@/lib/api/tours';

/**
 * Một ô trong dải ảnh full-bleed của `RegionGroup` (Task 4c, thay bố cục hai
 * cột của Task 4b). Cơ chế "giãn khi hover" và khung caption đè-giữa-ảnh lấy
 * nguyên từ `destination-tile.tsx` của Nexora (xem brief) — CHỈ khác:
 *  · Không `next/image` — dùng `ImagePlaceholder` (chính sách static-first,
 *    chưa có ảnh thật trong repo).
 *  · Link `/tours?destinations=<slug>` (trang lọc tour CÓ THẬT), không phải
 *    `/destinations/<region>?d=<slug>` — v2 không có cơ chế `?d=`.
 *  · Panel trồi lên khi hover/focus in MÔ TẢ + SỐ TOUR của chính địa điểm
 *    (không lặp lại "View more" — link đó đã có một lần duy nhất ở header
 *    `RegionGroup`).
 *
 * `variant`: ô ĐẦU (feature) chữ to hơn ô còn lại (photo) — theo đúng thứ tự
 * `destinations` truyền vào (không phải do component tự chọn).
 */
const TILE_ACCORDION =
  'sm:flex-1 sm:basis-0 motion-safe:sm:transition-[flex-grow] motion-safe:sm:duration-700 motion-safe:sm:ease-in-out motion-safe:sm:hover:grow-[2.5] motion-safe:sm:focus-within:grow-[2.5]';

export function DestinationTile({
  destination,
  variant,
}: {
  destination: DestinationVM;
  variant: 'feature' | 'photo';
}) {
  const t = messages.destinationsPage;
  /**
   * HAI CHẾ ĐỘ ĐỌC, không phải một. Comment bên dưới (vòng thiết kế Task 4c) đã
   * dặn trước: nền phẳng thì bỏ scrim và dùng cặp token theo-theme, còn "khi có
   * ảnh thật thì mới quay lại mẫu phủ-tối + chữ trắng". Nay khe có ảnh cho 9/19
   * địa danh, nên thẻ phải phục vụ CẢ HAI trạng thái cùng lúc — dùng một cách
   * xử lý cho cả hai là hỏng một nửa: `text-foreground` (mực đậm ở light) đè
   * lên ảnh thì mất hút, còn phủ tối lên ô giữ chỗ màu phẳng thì ra tấm xám
   * chết đúng như vòng trước đã dựng thử rồi bác.
   */
  const hasImage = destination.cover !== null;

  return (
    <a
      href={`/tours?destinations=${destination.slug}`}
      className={cn(
        'group relative block overflow-hidden',
        variant === 'feature' ? 'h-64 min-h-56 sm:h-full' : 'h-48 min-h-40 sm:h-full',
        TILE_ACCORDION,
      )}
    >
      {/* `corner` — prop có sẵn của `ImagePlaceholder` cho ĐÚNG tình huống này:
          "nép icon+nhãn xuống góc dưới-trái thay vì căn giữa, dùng khi
          placeholder làm NỀN cho nội dung căn giữa". Không có nó thì icon nằm
          giữa ô, đâm thẳng vào caption `<h3>` cũng căn giữa — đã chụp màn hình
          thấy hai thứ chồng lên nhau.
          Vẫn KHÔNG truyền `label`: tên địa điểm đã có ở `<h3>`, in thêm ở góc
          là lặp cùng một chữ hai lần trên một ô. `SlotImage` giữ nguyên hợp
          đồng prop của `ImagePlaceholder` nên chỗ này không phải sắp lại gì;
          `alt` để rỗng vì tên địa danh đã nằm ở `<h3>` ngay trên ảnh. */}
      <SlotImage
        image={destination.cover}
        corner
        className="absolute inset-0 h-full w-full"
        sizes="(min-width: 640px) 33vw, 100vw"
      />

      {/* Scrim HAI LỚP — lệch khỏi công thức `bg-overlay/25 → /55` của Nexora vì
          nền ở đây là `ImagePlaceholder` (`--muted`, RẤT SÁNG ở light mode), khác
          ảnh thật của Nexora vốn tự mang độ tối riêng. Đo bằng WCAG luminance
          (oklch → linear sRGB) trên chính token thật của repo: `bg-overlay/25`
          composite với `--muted` sáng chỉ đạt ~1.6:1 — KHÔNG đọc được. Một lớp
          `bg-overlay` KHÔNG chia (alpha gốc 0.5/0.6) đạt ~4.6:1 (light) / 16.6:1
          (dark) — đủ AA cho tên (chữ lớn). Lớp thứ hai trồi lên khi
          hover/focus cộng dồn alpha ~0.75/0.84 — ~11:1 (light) / ~19:1 (dark),
          đủ AA cho mô tả nhỏ trồi lên cùng lúc. Đây là lớp bảo vệ cho đúng lỗi
          "3 lần liên tiếp" ghi trong brief — không dùng số của Nexora rồi hy
          vọng có ảnh thật che lại. */}
      {/* KHÔNG có lớp phủ tối, và đây là chỗ CỐ Ý lệch khỏi Nexora.
          Nexora phủ `bg-overlay/25` rồi in chữ trắng — đẹp vì nền họ là ẢNH
          THẬT, tự có sáng-tối. Ở đây nền là `ImagePlaceholder` (`--muted`, một
          màu PHẲNG), mà phủ đều một lớp tối lên màu phẳng thì vẫn ra màu phẳng:
          đã dựng thử và chụp lại — ô thành một tấm xám chết, người xem đọc
          thành "vùng ảnh hỏng" chứ không phải "ảnh có lớp phủ".
          Nên bỏ hẳn lớp phủ và để caption dùng cặp token theo-theme
          (`bg-muted` + `text-foreground`): sáng trên nền sáng ở light, tối trên
          nền tối ở dark — hệ token bảo đảm đọc được ở CẢ HAI theme mà không cần
          scrim. Khi có ảnh thật thì mới quay lại mẫu phủ-tối + chữ trắng. */}
      {hasImage ? (
        /* CÓ ẢNH THẬT → quay lại mẫu phủ-tối + chữ sáng, đúng như vòng trước
           dặn. Ba điều dưới đây đều rút ra từ SỐ ĐO, không phải ước lượng.

           1. KHÔNG chia alpha. `--overlay` đã là `oklch(0 0 0 / 0.5)`, tự mang
              alpha sẵn, mà cú pháp `/NN` của Tailwind NHÂN vào alpha đó — nên
              `bg-overlay/55` chỉ còn ~27% đen chứ không phải 55%. Đo được hậu
              quả: tên ô sáng nhất (Hội An) chỉ 1.72:1 ở light.

           2. MỘT lớp vẫn chưa đủ. Ở ~0.5 alpha, ô Hội An đạt 2.92:1 — dưới cả
              ngưỡng 3:1. Tính ngược: ảnh đó luminance ~0.585, muốn 4.5:1 với
              chữ `on-media` thì cần alpha ≥ 0.71. Hai lớp chồng cho
              0.5 + 0.5×(1−0.5) = 0.75, vừa đủ và còn biên.

           3. GRADIENT chứ không phủ phẳng. Phủ phẳng 0.75 đạt chuẩn (5.90:1)
              nhưng dìm cả tấm ảnh thành nâu đục — vừa mới gắn ảnh vào đã làm
              nó biến mất thì vô nghĩa. Caption nằm GIỮA ô, nên hai gradient
              `transparent → overlay → transparent` dồn độ đậm đúng dải chữ và
              trả lại độ trong cho mép trên/dưới. Đo bản gradient: xấu nhất
              5.29:1 (light nghỉ) — vẫn trên 4.5 ở cả bốn trạng thái. */
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-transparent via-overlay to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-transparent via-overlay to-transparent"
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-foreground/0 transition-colors duration-500 group-hover:bg-foreground/5 motion-reduce:transition-none"
        />
      )}

      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center p-4 text-center',
          hasImage ? 'text-on-media' : 'text-foreground',
          variant === 'feature' ? 'p-5' : 'p-4',
        )}
      >
        <h3
          className={cn(
            'font-heading leading-tight font-semibold',
            variant === 'feature' ? 'text-2xl' : 'text-lg',
          )}
        >
          {destination.name}
        </h3>

        {/* Mô tả + số tour + mũi tên — LUÔN ở trong DOM (bàn phím/đọc màn hình
            tới được), chỉ ẩn thị giác ở trạng thái nghỉ bằng
            `grid-rows-[0fr]` + `opacity-0`. `group-focus-visible` để tab bàn
            phím cũng trồi được, không chỉ hover chuột. */}
        {destination.description ? (
          <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out motion-reduce:transition-none group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
            <div className="flex min-h-0 flex-col items-center gap-1 overflow-hidden pt-2">
              {/* `text-foreground/80` chứ KHÔNG phải `text-muted-foreground`:
                  nền ở đây là `bg-muted` (của `ImagePlaceholder`), mà cặp
                  muted-foreground/muted không dành cho nhau — đo được 3.35:1
                  (light) và 4.06:1 (dark), dưới ngưỡng AA 4.5 cho chữ 12px.
                  Hạ alpha giữ được thứ bậc so với tên mà vẫn đủ tương phản. */}
              <span
                className={cn(
                  'text-xs text-pretty',
                  hasImage ? 'text-on-media/90' : 'text-foreground/80',
                )}
              >
                {destination.description}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium">
                {t.toursLabel(destination.tourCount)}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </a>
  );
}
