/**
 * Hộp nhớ MỘT đường quay lại sau khi có phiên (D6, mục 1b spec P5b-4) —
 * module-scope, KHÔNG persist qua app kill (đúng ý: mất phiên giữa chừng thì
 * thôi, không cố khôi phục qua nhiều lần mở app).
 */
export interface PendingReturn {
  /** Đường expo-router điều hướng TỚI sau khi có phiên, vd '/(tabs)/saved'. */
  path: string;
  /** Việc dở màn đích tự làm nốt (D6: tự lưu wishlist). Chuỗi định danh + payload
      thay vì closure — closure sống sót qua unmount/remount của chuỗi màn auth là
      giả định không chắc chắn. */
  replay?: { kind: 'wishlist'; tourId: string };
}

let pending: PendingReturn | null = null;

/** Gọi lúc bấm "Sign in"/"Create account" từ một chỗ bị chặn (AuthGateScreen/AuthGateSheet). */
export function setPendingReturn(next: PendingReturn): void {
  pending = next;
}

/** Gọi Ở CHẶNG AUTH khi thành công — chỉ lấy path, KHÔNG xoá `replay` (màn đích
    còn cần đọc nó sau khi điều hướng tới). */
export function consumeReturnPath(): string | null {
  return pending?.path ?? null;
}

/** Gọi Ở MÀN ĐÍCH (effect mount-once, sau khi `signedIn` vừa bật — màn có thể
    vẫn đang mount sẵn dưới modal đăng nhập, không nhất thiết vừa điều hướng
    tới) — lấy VÀ xoá hẳn `pending`. Đây mới là điểm thật sự dọn hộp nhớ về rỗng. */
export function consumePendingReplay(): PendingReturn['replay'] {
  const replay = pending?.replay;
  pending = null;
  return replay;
}

/** Gọi khi khách RỜI chuỗi đăng nhập MÀ CHƯA đăng nhập (đóng màn Sign in bằng nút
    X) — dọn sạch ý định cũ, tránh một lượt đăng nhập KHÁC không liên quan sau
    đó vô tình nhặt lại đường quay-về/replay của lượt đã bỏ dở. */
export function clearPendingReturn(): void {
  pending = null;
}
