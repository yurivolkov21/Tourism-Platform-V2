/**
 * Chuyển cảnh dùng chung cho mọi Stack — một nguồn để push/back đồng nhất.
 * - `ios_from_right`: Android trượt vào/ra mượt kiểu iOS (có parallax màn dưới);
 *   iOS tự rơi về chuyển cảnh gốc.
 * - `fullScreenGestureEnabled`: iOS vuốt lùi từ bất kỳ đâu, không chỉ mép trái.
 * - `animationMatchesGesture`: iOS animation lùi bám theo tốc độ tay vuốt.
 */
export const STACK_TRANSITION = {
  animation: 'ios_from_right',
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
} as const;
