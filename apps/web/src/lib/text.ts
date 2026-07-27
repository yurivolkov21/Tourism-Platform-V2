/** Bỏ dấu tiếng Việt để gõ "ha long" vẫn tìm ra "Hạ Long" — khách nước ngoài
    không gõ được dấu, mà địa danh trong dữ liệu thì có dấu đầy đủ.
    Tách khỏi lib/blog.ts (nơi nó ra đời) vì cả blog lẫn tours đều cần. */
export function foldAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
