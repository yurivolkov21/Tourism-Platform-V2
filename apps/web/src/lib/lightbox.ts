/**
 * Thu/phóng trong lightbox — phần logic thuần, tách khỏi component để test được
 * mà không cần dựng DOM và đo layout thật.
 *
 * Bản duyệt (`docs/design/mockups/tour-detail.src.html`) có SẴN phần CSS cho
 * việc này — `.lb-stage` với `cursor:zoom-in`, `.zoomed` đổi sang `grab`,
 * `.dragging` tắt transition, và một ô `.lb-zoom` in số phần trăm — nhưng
 * KHÔNG có dòng JS nào. Hành vi dưới đây là mới, chỉ khung hình là bám bản duyệt.
 */

/**
 * Thang thu/phóng RỜI RẠC, không liên tục.
 *
 * Một thang rời cho ba thứ mà zoom liên tục không cho: nút bấm biết mình sẽ tới
 * đâu, con số hiện ra luôn tròn (100/150/200/300 — không bao giờ "137%"), và
 * hai lần bấm ở hai phiên khác nhau cho cùng một kết quả. Trần 3× vì ảnh
 * catalog là ảnh web, phóng quá đó chỉ thấy pixel.
 */
export const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

const MIN = ZOOM_STEPS[0];
const MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1] as number;

/**
 * Nấc kế tiếp theo hướng `direction` (+1 phóng, −1 thu).
 *
 * Giá trị KHÔNG nằm trên thang được kéo về nấc gần nhất trước khi đi tiếp —
 * nếu không, một state lạ bơm từ ngoài sẽ làm nút bấm kẹt cứng.
 */
export function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex((step) => step >= current - 1e-9);
  const base = index === -1 ? ZOOM_STEPS.length - 1 : index;
  // Đang ở giữa hai nấc và đi xuống: `base` đã trỏ nấc TRÊN, nên lùi thêm một.
  const onStep = Math.abs((ZOOM_STEPS[base] as number) - current) < 1e-9;
  const target = direction === 1 ? base + (onStep ? 1 : 0) : base - 1;
  return (ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, target))] as number) ?? MIN;
}

/** `1.5` → `150`. Số nguyên: ô `.lb-zoom` rộng 44px, không chứa nổi phần lẻ. */
export function zoomPercent(scale: number): number {
  return Math.round(scale * 100);
}

export interface PanOffset {
  x: number;
  y: number;
}

/**
 * Kẹp độ dời khi kéo ảnh đã phóng, để không kéo được ảnh ra khỏi khung.
 *
 * Biên là NỬA phần thừa mỗi chiều: ở 2× trong khung 800 thì ảnh rộng 1600, thừa
 * 800, kéo tối đa 400 sang mỗi bên — đúng lúc mép ảnh chạm mép khung.
 *
 * Ở 1× biên bằng 0 nên hàm tự trả `{0,0}`: không có gì thừa thì không có gì để
 * kéo, và cho kéo lúc đó là để người dùng đẩy ảnh ra khỏi màn hình.
 *
 * Khung `0×0` xảy ra thật ở lần render đầu (chưa đo được layout) — phải trả 0
 * chứ không phải `NaN`, vì `NaN` đi thẳng vào `transform` và ảnh biến mất.
 */
export function clampPan(
  offset: PanOffset,
  scale: number,
  box: { width: number; height: number },
): PanOffset {
  const limitX = Math.max(0, (box.width * scale - box.width) / 2);
  const limitY = Math.max(0, (box.height * scale - box.height) / 2);
  return {
    x: Math.min(limitX, Math.max(-limitX, offset.x)) || 0,
    y: Math.min(limitY, Math.max(-limitY, offset.y)) || 0,
  };
}

/** Có kéo được không — dùng để đổi con trỏ và bật/tắt handler kéo. */
export function canPan(scale: number): boolean {
  return scale > MIN;
}

export { MAX as ZOOM_MAX, MIN as ZOOM_MIN };
