/**
 * Quy số dọc của bản thiết kế về màn hình thật.
 *
 * Khung điện thoại trong `docs/design/mockups/mobile-auth-screens.src.html` là
 * **324×700 px** — một hình minh hoạ thu nhỏ, không phải khung máy. Chép thẳng
 * số pixel đó thành dp (đợt dựng 16/09) làm mọi thứ theo chiều dọc lệch tỉ lệ:
 * ảnh bìa 300px là 42,9% khung vẽ nhưng chỉ còn 35,5% trên máy 844dp, nên ảnh
 * thấp hơn thiết kế và đáy màn thừa một khoảng trống.
 *
 * Chỉ quy đổi số DỌC. Đệm ngang và cỡ chữ vẫn theo token: 24dp lề là 24dp trên
 * mọi máy, kéo giãn theo bề ngang chỉ làm lề rộng vô duyên trên máy to.
 */
export const MOCKUP_FRAME_HEIGHT = 700;

/** `px` đo trên khung 324×700 → dp trên màn cao `screenHeight`. */
export function fromMockup(px: number, screenHeight: number): number {
  return Math.round((px / MOCKUP_FRAME_HEIGHT) * screenHeight);
}
