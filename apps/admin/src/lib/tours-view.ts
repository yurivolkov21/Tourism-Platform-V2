import type { AdminTourRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';
import { departuresHref } from './tours-query';

/**
 * Mapper hiển thị vùng `/tours` (spec P4e-1 §3-F11) — THUẦN, ngoài React nên
 * test được từng nhánh; bảng chỉ render VM có sẵn, không có chỗ nào trong JSX
 * tự format tiền hay tự ghép đường dẫn.
 *
 * Tiền mượn `formatAmount` của `bookings-view` (giữ đủ hai số lẻ) — một luật
 * đọc tiền cho cả back-office.
 */

const t = messages.admin.tours.list;

/** Một hàng của bảng `/tours`. */
export interface TourRowVM {
  id: string;
  slug: string;
  title: string;
  category: string;
  /** Giá niêm yết đã format ("$199.00"). */
  price: string;
  /**
   * Con số THÔ — bảng vẽ nó to và đậm, còn câu đầy đủ chỉ dành cho trình đọc
   * màn hình (`countLabel`). Giữ số để cột còn so sánh/nhấn mạnh được ở mức 0.
   */
  openDepartureCount: number;
  /** "3 open departures" — tên đọc-màn-hình của ô đếm. */
  countLabel: string;
  isPublished: boolean;
  isFeatured: boolean;
  heroUrl: string | null;
  /** Màn chuyến khởi hành của tour này (F12 dựng). */
  departuresHref: string;
  /** Tên đọc-màn-hình của link sang màn chuyến. */
  departuresLabel: string;
}

/** Row của contract → hàng bảng đã format sẵn (server component gọi). */
export function toTourRowVM(row: AdminTourRow): TourRowVM {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.categoryName,
    price: formatAmount(row.basePrice, row.currency),
    openDepartureCount: row.openDepartureCount,
    countLabel: t.openDepartures(row.openDepartureCount),
    isPublished: row.isPublished,
    isFeatured: row.isFeatured,
    heroUrl: row.heroUrl,
    departuresHref: departuresHref(row.slug),
    departuresLabel: t.manageDepartures(row.title),
  };
}
