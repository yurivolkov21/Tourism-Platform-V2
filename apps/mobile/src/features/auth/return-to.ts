/**
 * Hộp nhớ MỘT đường quay lại sau khi có phiên (D6, mục 1b spec P5b-4) —
 * module-scope, KHÔNG persist qua app kill (đúng ý: mất phiên giữa chừng thì
 * thôi, không cố khôi phục qua nhiều lần mở app).
 *
 * `path` và `replay` có vòng đời RIÊNG (F1, review 06/10): `path` do chặng
 * auth đọc đúng một lần lúc đăng nhập xong; `replay` do màn đích đọc — có khi
 * TRƯỚC cả lúc đó (tour detail mount sẵn dưới modal, effect chạy ngay khi
 * `signedIn` bật). Gộp chung một biến thì bên nào đọc trước là xoá mất phần
 * của bên kia.
 */
export interface PendingReturn {
  /** Đường expo-router điều hướng TỚI sau khi có phiên, vd '/(tabs)/saved'. */
  path: string;
  /** Việc dở màn đích tự làm nốt (D6: tự lưu wishlist). Chuỗi định danh + payload
      thay vì closure — closure sống sót qua unmount/remount của chuỗi màn auth là
      giả định không chắc chắn. */
  replay?: { kind: 'wishlist'; tourId: string };
}

let pendingPath: string | null = null;
let pendingReplay: PendingReturn['replay'];
/** Chặng auth đã đọc `path` (= đăng nhập/đăng ký xong) — từ lúc này `replay`
    thuộc về màn đích, rời nhóm (auth) không được xoá nó nữa. */
let pathConsumed = false;

/** Gọi lúc bấm "Sign in"/"Create account" từ một chỗ bị chặn (AuthGateScreen/AuthGateSheet). */
export function setPendingReturn(next: PendingReturn): void {
  pendingPath = next.path;
  pendingReplay = next.replay;
  pathConsumed = false;
}

/** Gọi Ở CHẶNG AUTH khi thành công — lấy VÀ xoá `path`, KHÔNG đụng `replay`
    (màn đích còn cần đọc nó sau khi điều hướng tới). */
export function consumeReturnPath(): string | null {
  const path = pendingPath;
  pendingPath = null;
  if (path !== null) pathConsumed = true;
  return path;
}

/** Gọi Ở MÀN ĐÍCH (effect mount-once, sau khi `signedIn` vừa bật — màn có thể
    vẫn đang mount sẵn dưới modal đăng nhập, không nhất thiết vừa điều hướng
    tới) — lấy VÀ xoá `replay`. Không đụng `path`: chặng auth có thể chưa đọc. */
export function consumePendingReplay(): PendingReturn['replay'] {
  const replay = pendingReplay;
  pendingReplay = undefined;
  return replay;
}

/** Gọi khi khách đóng màn Sign in bằng nút X — dọn sạch ý định cũ, tránh một
    lượt đăng nhập KHÁC không liên quan sau đó vô tình nhặt lại đường
    quay-về/replay của lượt đã bỏ dở. */
export function clearPendingReturn(): void {
  pendingPath = null;
  pendingReplay = undefined;
  pathConsumed = false;
}

/**
 * Gọi khi nhóm (auth) UNMOUNT — bất kể rời bằng đường nào: nút X, back cứng
 * Android, vuốt đóng modal iOS, hay `router.replace` sau khi đăng nhập xong
 * (F1, review 06/10: trước chỉ nút X dọn, nên back/vuốt để lại đích cũ cho
 * lượt đăng nhập sau). Chưa đăng nhập xong → dọn sạch; đã xong → `path` đã
 * được đọc, chỉ giữ `replay` cho màn đích.
 */
export function abandonPendingReturn(): void {
  if (pathConsumed) {
    pathConsumed = false;
    return;
  }
  clearPendingReturn();
}
