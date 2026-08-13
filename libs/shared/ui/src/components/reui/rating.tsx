'use client';

import { cn } from '@tourism/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { StarIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Rating của ReUI (registry `base-nova`), port vào repo với BA thay đổi so với
 * bản gốc — ghi ở đây để lần sau nâng cấp không vô tình chép ngược lại:
 *
 * 1. **Màu theo token, không theo bảng màu Tailwind.** Bản gốc hardcode
 *    `fill-yellow-400 text-yellow-400` cho sao đầy và `text-muted-foreground/30`
 *    cho sao rỗng. Dự án có token sinh ra đúng cho việc này — `--rating` và
 *    `--rating-muted` (xem `style-dictionary/tokens.mjs`, cùng cặp mà
 *    `tour-reviews` và `passport` đang dùng) — nên đổi sang `fill-rating` /
 *    `text-rating-muted`. Luật 6 CLAUDE.md: tokens-only. `rating.spec.ts` canh.
 *
 * 2. **Icon lấy thẳng từ `lucide-react`.** Bản gốc dùng `IconPlaceholder`, một
 *    lớp bọc riêng của reui.io cho phép đổi qua lại 5 bộ icon lúc sinh code.
 *    Repo chỉ dùng lucide nên lớp đó là phụ thuộc chết.
 *
 * 3. **Bấm được bằng bàn phím.** Bản gốc gắn `onClick` lên `<div>`: chuột dùng
 *    được, bàn phím và trình đọc màn hình thì không. Ở chế độ `editable`, mỗi
 *    sao là `<button type="button">` có `aria-label`; ở chế độ chỉ-đọc, cả cụm
 *    là một `role="img"` với nhãn gộp, để trình đọc màn hình đọc "4.4 out of 5"
 *    thay vì năm icon vô nghĩa.
 */

const ratingVariants = cva('flex items-center', {
  variants: {
    size: { sm: 'gap-2', default: 'gap-2.5', lg: 'gap-3' },
  },
  defaultVariants: { size: 'default' },
});

const starVariants = cva('', {
  variants: {
    size: { sm: 'size-4', default: 'size-5', lg: 'size-6' },
  },
  defaultVariants: { size: 'default' },
});

const valueVariants = cva('text-muted-foreground w-5', {
  variants: {
    size: { sm: 'text-xs', default: 'text-sm', lg: 'text-base' },
  },
  defaultVariants: { size: 'default' },
});

/** Tách hằng để test canh được là màu vẫn bám token (xem rating.spec.ts). */
export const filledStarClass = 'fill-rating text-rating';
export const emptyStarClass = 'fill-rating-muted text-rating-muted';

/**
 * Phần trăm bề rộng lớp sao ĐẦY phủ lên sao thứ `starIndex` (đếm từ 1).
 *
 * Tách khỏi JSX để test được ở môi trường `node` — vitest của gói này không
 * dựng jsdom. Bản gốc tính thẳng trong vòng lặp render và KHÔNG kẹp biên, nên
 * `rating` âm cho ra `width` âm còn `rating` vượt `maxRating` cho ra hơn 100%;
 * kiểu của prop là `number` tự do nên cả hai đều là đầu vào hợp lệ.
 */
export function starFillPercent(rating: number, starIndex: number): number {
  if (!Number.isFinite(rating)) return 0;
  const filled = rating - (starIndex - 1);
  if (filled <= 0) return 0;
  if (filled >= 1) return 100;
  return filled * 100;
}

function Rating({
  rating,
  maxRating = 5,
  size,
  className,
  starClassName,
  showValue = false,
  editable = false,
  onRatingChange,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof ratingVariants> & {
    /** Current rating value (supports decimal values for partial stars) */
    rating: number;
    /** Maximum rating value (number of stars to show) */
    maxRating?: number;
    /** Whether to show the numeric rating value */
    showValue?: boolean;
    /** Class name for the value span */
    starClassName?: string;
    /** Whether the rating is editable (clickable) */
    editable?: boolean;
    /** Callback function called when rating changes */
    onRatingChange?: (rating: number) => void;
  }) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const displayRating = editable && hoveredRating !== null ? hoveredRating : rating;

  const stars = Array.from({ length: maxRating }, (_, i) => {
    const starIndex = i + 1;
    const percent = starFillPercent(displayRating, starIndex);

    // Hai lớp chồng nhau: sao rỗng nằm dưới, sao đầy nằm trên trong một hộp bị
    // cắt theo bề ngang — nhờ vậy sao lẻ (4.4) hiện đúng 40% chứ không làm tròn.
    const glyphs = (
      <>
        <StarIcon
          aria-hidden="true"
          data-slot="rating-star-empty"
          className={cn(starVariants({ size }), emptyStarClass, starClassName)}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${percent}%` }}
        >
          <StarIcon
            data-slot="rating-star-filled"
            className={cn(starVariants({ size }), filledStarClass, starClassName)}
          />
        </span>
      </>
    );

    return editable ? (
      <button
        key={starIndex}
        type="button"
        data-slot="rating-star"
        aria-label={`${starIndex} / ${maxRating}`}
        aria-pressed={Math.ceil(rating) === starIndex}
        className="relative cursor-pointer"
        onClick={() => onRatingChange?.(starIndex)}
        onMouseEnter={() => setHoveredRating(starIndex)}
        onMouseLeave={() => setHoveredRating(null)}
        onFocus={() => setHoveredRating(starIndex)}
        onBlur={() => setHoveredRating(null)}
      >
        {glyphs}
      </button>
    ) : (
      <span key={starIndex} data-slot="rating-star" className="relative">
        {glyphs}
      </span>
    );
  });

  return (
    <div
      data-slot="rating"
      className={cn(ratingVariants({ size }), className)}
      // Chỉ-đọc: gộp thành MỘT nhãn. Ở chế độ sửa được thì không gộp — từng nút
      // đã có nhãn riêng, thêm role ở đây sẽ che mất chúng.
      {...(editable ? {} : { role: 'img', 'aria-label': `${rating} / ${maxRating}` })}
      {...props}
    >
      <div className="flex items-center">{stars}</div>
      {showValue ? (
        <span data-slot="rating-value" className={cn(valueVariants({ size }))}>
          {displayRating.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

export { Rating };
