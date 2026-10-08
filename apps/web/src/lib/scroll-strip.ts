/**
 * Hai phép tính thuần cho một dải cuộn NGANG có mờ mép — dải 5 tab của trang
 * tour dưới 640px (`components/tours/tour-tabs.tsx`). Tách khỏi component để
 * test bằng số đo thật: jsdom không có layout nên mọi phép đo trong component
 * đều phải giả lập, còn ở đây chỉ là số vào, số ra.
 */

/** Dưới 1px coi như đã chạm mép. Màn DPR 2–3 cho `scrollLeft` lẻ (0.5,
    150.67…): không có dung sai thì mép mờ bật lên lúc nghỉ dù chẳng còn gì bị che. */
const EDGE_TOLERANCE = 1;

export type ScrollMetrics = { scrollLeft: number; scrollWidth: number; clientWidth: number };

/** Mép nào của dải còn nội dung bị che. Mép đó mới mờ, mép kia giữ nét. */
export function scrollEdges({ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics): {
  start: boolean;
  end: boolean;
} {
  return {
    start: scrollLeft > EDGE_TOLERANCE,
    end: scrollWidth - clientWidth - scrollLeft > EDGE_TOLERANCE,
  };
}

/**
 * `scrollLeft` mới để một phần tử (toạ độ trong hệ cuộn, `itemStart`–`itemEnd`)
 * lộ ra NGOÀI vùng mờ rộng `fade` ở hai mép. Đã lộ rõ thì giữ nguyên vị trí:
 * khách bấm một tab đang thấy rõ thì dải không được giật.
 *
 * Kết quả kẹp trong [0, cuộn tối đa], nên tab đầu về 0 và tab cuối về mức tối
 * đa. Ở hai đầu ấy mép tương ứng hết mờ, nên không cần chừa vùng mờ nữa.
 */
export function revealScrollLeft({
  scrollLeft,
  scrollWidth,
  clientWidth,
  itemStart,
  itemEnd,
  fade,
}: ScrollMetrics & { itemStart: number; itemEnd: number; fade: number }): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  let target = scrollLeft;
  if (itemStart - fade < scrollLeft) {
    target = itemStart - fade;
  } else if (itemEnd + fade > scrollLeft + clientWidth) {
    target = itemEnd + fade - clientWidth;
  }
  return Math.min(max, Math.max(0, target));
}
