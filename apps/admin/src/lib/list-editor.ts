/**
 * Phép biến đổi THUẦN của khung sửa danh sách (spec F17 §2h). Mỗi dòng mang
 * `key` riêng do client sinh: React giữ đúng nút DOM của dòng khi đổi chỗ, nên
 * tiêu điểm bàn phím đi theo dòng vừa dời thay vì ở lại vị trí cũ.
 */
export interface Keyed {
  key: string;
}

export function newItemKey(): string {
  return crypto.randomUUID();
}

/** Bản sao đã đổi chỗ hai vị trí; ra ngoài biên thì trả bản sao nguyên vẹn. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}
