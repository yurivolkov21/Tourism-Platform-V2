/**
 * Đổi trạng thái MỘT id trong tập đang lưu (E1/E4/D1 dùng chung) — trả về tập
 * MỚI (không sửa tập cũ), khớp khuôn cập nhật state bất biến của React.
 */
export function toggleWishedId(current: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
