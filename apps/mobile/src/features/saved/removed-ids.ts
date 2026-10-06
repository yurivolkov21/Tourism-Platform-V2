/**
 * Dọn tập id "đã bỏ lưu lạc quan" của tab Saved theo danh sách server mới
 * nhất (F4, review 06/10).
 *
 * Tập ẩn chỉ cần sống tới khi server XÁC NHẬN tour đã rời wishlist (= vắng
 * khỏi `wishlist.list`). Giữ lâu hơn là bug: khách lưu lại tour đó ở tour
 * detail/Explore thì list refetch có nó trở lại nhưng thẻ vẫn bị ẩn, bộ đếm
 * hiện N−1. Id server VẪN trả (mutation chưa xong, refetch chạy sớm) thì giữ
 * ẩn — đó đúng là lúc lớp lạc quan cần.
 *
 * Trả lại CHÍNH `removed` khi không có gì đổi, để `setState` bỏ qua render.
 */
export function pruneRemovedIds(
  removed: ReadonlySet<string>,
  serverItems: readonly { tourId: string }[],
): ReadonlySet<string> {
  if (removed.size === 0) return removed;
  const onServer = new Set(serverItems.map((item) => item.tourId));
  const next = new Set([...removed].filter((id) => onServer.has(id)));
  return next.size === removed.size ? removed : next;
}
