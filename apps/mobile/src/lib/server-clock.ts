/**
 * Đồng hồ server (handoff `mobile-booking-handoff.md` luật #5, cụm P
 * W7/W8): đếm ngược và mọi phép trừ ngày ở cụm P dùng giờ SERVER, không
 * phải giờ máy — giáo viên hay chỉnh đồng hồ máy lúc chấm.
 */

/** Lệch server − máy (ms), đo tại thời điểm `clientNowMs`. */
export function clockOffsetMs(serverTimestamp: string, clientNowMs: number): number {
  return new Date(serverTimestamp).getTime() - clientNowMs;
}

/** "Bây giờ" suy từ độ lệch đã đo cộng giờ máy hiện tại. */
export function serverNow(offsetMs: number, clientNowMs = Date.now()): Date {
  return new Date(clientNowMs + offsetMs);
}
