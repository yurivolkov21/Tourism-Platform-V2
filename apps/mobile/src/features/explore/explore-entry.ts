/**
 * Param điều hướng VÀO tab Explore từ nơi khác (Home) — F5.
 *
 * Tab Explore giữ mount giữa các lần chuyển tab, nên route đồng bộ bộ lọc điểm
 * đến theo param bằng effect. Hai lỗ hổng nếu chỉ dùng `destination`:
 * - "See all tours" mở `/explore` KHÔNG param → bộ lọc cũ còn nguyên;
 * - bấm lại đúng điểm đến cũ (sau khi khách tự bỏ lọc ở Explore) → param không
 *   đổi, effect không chạy lại.
 * Vì vậy mỗi lần vào luôn gửi `destination` tường minh (`''` = bỏ lọc) kèm
 * `nav` là nonce mới, để effect chạy lại kể cả khi `destination` y hệt.
 */
// `type` chứ không `interface`: `router.navigate` đòi param có index signature
// ngầm (`UnknownInputParams`), interface thì không có.
export type ExploreEntryParams = {
  destination: string;
  /** Danh mục (chip ở chi tiết tour, rà 01/11) — cùng luật `''` = bỏ lọc như `destination`. */
  category: string;
  nav: string;
};

/** Dựng param vào Explore; `null` = bỏ lọc tương ứng (điểm đến / danh mục). */
export function exploreEntryParams(
  destination: string | null,
  nonce: string,
  category: string | null = null,
): ExploreEntryParams {
  return { destination: destination ?? '', category: category ?? '', nav: nonce };
}

/**
 * Đọc param ra bộ lọc điểm đến cần áp: slug, `null` (bỏ lọc), hoặc `undefined`
 * khi param không ra lệnh gì (vào tab bằng thanh tab, không có `destination`) —
 * khi đó giữ nguyên lựa chọn hiện có.
 */
export function destinationFromEntryParams(params: {
  destination?: string;
}): string | null | undefined {
  return filterFromEntryParam(params.destination);
}

/** Như `destinationFromEntryParams`, cho danh mục. */
export function categoryFromEntryParams(params: { category?: string }): string | null | undefined {
  return filterFromEntryParam(params.category);
}

function filterFromEntryParam(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}
