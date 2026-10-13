/**
 * Lề ngang của trang `/checkout/success` quanh thẻ voucher — chép lề của `ContentHero` để mép thẻ
 * thẳng hàng tiêu đề.
 *
 * Khai Ở ĐÂY cùng `VOUCHER_PHOTO_SIZES` vì `sizes` của ảnh bìa trừ đúng các lề này (G35). Trước
 * đây trang tự gõ lớp, còn `voucher-overview.tsx` chép con số vào một chuỗi `sizes` và một comment:
 * đổi lề trang thì `sizes` sai lặng lẽ (trình duyệt tải ảnh to hay nhỏ hơn cần, không ai thấy).
 * Nay chuỗi `sizes` dựng từ cùng bảng số, và test đọc lại lớp Tailwind để canh hai thứ khớp nhau.
 */
export const VOUCHER_PAGE_GUTTER = 'px-4 md:px-16 lg:px-24 xl:px-32';

/** Bề rộng (px) MỘT bên lề của `VOUCHER_PAGE_GUTTER` theo mốc — test canh khớp với chuỗi lớp. */
export const VOUCHER_PAGE_GUTTER_PX = { base: 16, md: 64, lg: 96, xl: 128 } as const;

/** Viền thẻ voucher (`border`, 1px mỗi bên). */
const CARD_BORDER_PX = 2;
/** Đệm ngang cột trái của thẻ (`p-6 md:px-10` ở `voucher-overview.tsx`), cộng hai bên. */
const OVERVIEW_PADDING_PX = { base: 2 * 24, md: 2 * 40 } as const;
/** Mảng teal bên phải khi thẻ chia đôi (từ `xl`, `voucher-card.tsx`). */
const PASS_COLUMN_PX = 440;
/** Thẻ chặn ở `max-w-7xl`. */
const CARD_MAX_PX = 1280;

/**
 * `sizes` của ảnh bìa voucher = bề rộng ô ảnh: màn − lề trang − viền thẻ − đệm cột trái; từ `xl`
 * trừ thêm mảng teal. Từ mốc thẻ chạm `max-w-7xl` (1280 + hai lề `xl`) ô ảnh đứng yên. Mốc 1280px
 * là `xl` — mốc chia đôi của thẻ (`sizes` không đọc được biến thể CSS `voucher-split:`).
 */
export const VOUCHER_PHOTO_SIZES = (() => {
  const g = VOUCHER_PAGE_GUTTER_PX;
  const pad = OVERVIEW_PADDING_PX;
  const xlInset = 2 * g.xl + CARD_BORDER_PX + pad.md + PASS_COLUMN_PX;
  const frozenAt = CARD_MAX_PX + 2 * g.xl;
  return [
    `(min-width: ${frozenAt}px) ${frozenAt - xlInset}px`,
    `(min-width: 1280px) calc(100vw - ${xlInset}px)`,
    `(min-width: 1024px) calc(100vw - ${2 * g.lg + CARD_BORDER_PX + pad.md}px)`,
    `(min-width: 768px) calc(100vw - ${2 * g.md + CARD_BORDER_PX + pad.md}px)`,
    `calc(100vw - ${2 * g.base + CARD_BORDER_PX + pad.base}px)`,
  ].join(', ');
})();
