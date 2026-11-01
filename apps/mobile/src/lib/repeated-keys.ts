/**
 * Khoá xuất hiện từ hai lần trở lên trong danh sách. Dùng để chỉ gắn thêm mã đơn vào những dòng
 * trông y hệt nhau (vd ba thông báo "… is coming up" của ba đơn cùng một đợt khởi hành — rà 01/11,
 * A3), còn dòng đã tự phân biệt được thì giữ gọn.
 */
export function repeatedKeys<T>(items: readonly T[], key: (item: T) => string): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) repeated.add(k);
    else seen.add(k);
  }
  return repeated;
}
