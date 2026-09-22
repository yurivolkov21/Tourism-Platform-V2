import type { AdminCategoryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Mapper hiển thị bảng danh mục (spec P4e-2 F14) — THUẦN, nằm ngoài React nên
 * test được từng nhánh. Bảng chỉ render VM có sẵn: không chỗ nào trong JSX tự
 * đếm chỉ số hay tự đoán nút nào bấm được.
 *
 * Nhận CẢ MẢNG chứ không từng hàng, khác `toDepartureRowVM`. Lý do: "hàng này
 * có phải hàng đầu không" là câu hỏi về VỊ TRÍ trong danh sách, không phải về
 * hàng. Đưa từng hàng vào thì mỗi chỗ gọi lại phải tự đếm chỉ số — và chỗ đếm
 * sai đầu tiên là chỗ nút lên/xuống nói dối.
 */

const t = messages.admin.categories;

export interface CategoryRowVM {
  id: string;
  /** Slug thô — dialog in ra, và nó KHÔNG sửa được sau khi tạo. */
  slug: string;
  name: string;
  /** Mô tả để HIỂN THỊ: bản thô, hoặc một câu thay thế khi trống. */
  description: string;
  /**
   * Mô tả THÔ (rỗng khi chưa có) — dành riêng cho form sửa.
   *
   * Đi riêng khỏi `description` có chủ đích: suy ngược từ bản hiển thị bằng
   * cách so với câu thay thế thì một danh mục có mô tả thật đúng bằng câu ấy
   * sẽ mở ra ô trống, và lưu một phát là mất mô tả.
   */
  descriptionValue: string;
  isActive: boolean;
  statusLabel: string;
  tourCount: number;
  toursLabel: string;
  /**
   * Hai lá cờ này là bản SOI GƯƠNG của luật server (`CANNOT_MOVE`). Gương chứ
   * không phải nguồn — server vẫn từ chối thật; đây chỉ để nút không mời admin
   * bấm một thứ chắc chắn ăn 409.
   */
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * Một trang contract → các hàng bảng.
 *
 * GIỮ NGUYÊN thứ tự server trả về. Server đã sắp theo `order`; sắp lần hai ở
 * client là mở đường cho hai thước khác nhau nói hai chuyện khác nhau.
 */
export function toCategoryRowVMs(rows: AdminCategoryRow[]): CategoryRowVM[] {
  return rows.map((row, index) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? t.list.inherited,
    descriptionValue: row.description ?? '',
    isActive: row.isActive,
    statusLabel: row.isActive ? t.list.active : t.list.inactive,
    tourCount: row.tourCount,
    toursLabel: t.list.tours(row.tourCount),
    canMoveUp: index > 0,
    canMoveDown: index < rows.length - 1,
  }));
}

/** Badge theo trạng thái — cùng bảng tone với các vùng khác của back office. */
export function categoryStatusBadgeVariant(isActive: boolean): 'default' | 'secondary' {
  return isActive ? 'default' : 'secondary';
}
