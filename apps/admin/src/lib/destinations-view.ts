import { type AdminDestinationRow, findRegion, REGIONS, type RegionName } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Mapper hiển thị bảng điểm đến (spec P4e-2 F15) — THUẦN, nằm ngoài React nên
 * test được từng nhánh. Bảng chỉ render VM có sẵn.
 *
 * Nhận TỪNG hàng, khác `toCategoryRowVMs`: danh mục cần biết vị trí trong danh
 * sách để tắt mũi tên ở hai biên, còn bảng này không có thứ tự nào để sắp.
 *
 * Phần đáng kể nhất là `regionName` — "chuẩn hoá `region`" của spec §5. Cột DB
 * là chữ tự do, và web xếp điểm đến vào trang vùng bằng `findRegion` của
 * contract. VM đọc CHÍNH hàm ấy, nên bảng admin và trang vùng không thể đọc
 * cùng một hàng ra hai vùng khác nhau (ADR-0045).
 */

const t = messages.admin.destinations;

export interface DestinationRowVM {
  id: string;
  /** Slug thô — dialog in ra, và nó KHÔNG sửa được sau khi tạo. */
  slug: string;
  name: string;
  country: string;
  /**
   * Tên vùng CHUẨN mà web xếp hàng này vào, hoặc `null` khi chuỗi trong DB
   * không khớp vùng nào — tức điểm đến không hiện ở trang vùng nào cả. Form
   * sửa chọn sẵn ô vùng bằng giá trị này; `null` thì ô trống, bắt chọn lại.
   */
  regionName: RegionName | null;
  /** Nhãn cột Region: tên vùng, hoặc một câu báo "không có vùng". */
  regionLabel: string;
  /** Mô tả để HIỂN THỊ: bản thô, hoặc một câu thay thế khi trống. */
  description: string;
  /**
   * Mô tả THÔ (rỗng khi chưa có) — dành riêng cho form sửa. Đi riêng khỏi
   * `description` cùng lý do của danh mục: suy ngược từ bản hiển thị thì một
   * mô tả thật đúng bằng câu thay thế sẽ mở ra ô trống.
   */
  descriptionValue: string;
  isActive: boolean;
  statusLabel: string;
  tourCount: number;
  toursLabel: string;
}

/** Một hàng contract → một hàng bảng. */
export function toDestinationRowVM(row: AdminDestinationRow): DestinationRowVM {
  const region = findRegion(REGIONS, row.region);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    regionName: region?.name ?? null,
    regionLabel: region?.name ?? t.list.noRegion,
    description: row.description ?? t.list.inherited,
    descriptionValue: row.description ?? '',
    isActive: row.isActive,
    statusLabel: row.isActive ? t.list.active : t.list.inactive,
    tourCount: row.tourCount,
    toursLabel: t.list.tours(row.tourCount),
  };
}

/** Badge theo trạng thái — cùng bảng tone với danh mục. */
export function destinationStatusBadgeVariant(isActive: boolean): 'default' | 'secondary' {
  return isActive ? 'default' : 'secondary';
}
