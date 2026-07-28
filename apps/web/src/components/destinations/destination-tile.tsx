import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowRightIcon } from 'lucide-react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { MockDestination } from '@/mocks/types';

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
  destination: MockDestination;
  variant: 'feature' | 'photo';
}) {
  const t = messages.destinationsPage;

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
          là lặp cùng một chữ hai lần trên một ô. */}
      <ImagePlaceholder corner className="absolute inset-0 h-full w-full" />

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
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/0 transition-colors duration-500 group-hover:bg-foreground/5 motion-reduce:transition-none"
      />

      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-foreground',
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
              <span className="text-xs text-pretty text-foreground/80">
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
