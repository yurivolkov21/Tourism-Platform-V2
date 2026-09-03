import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị vùng `/subscribers` (spec P4c §3-F10) — THUẦN, ngoài React
 * nên test được từng nhánh; bảng chỉ render VM có sẵn.
 *
 * Ngày giờ mượn `bookings-view` (in UTC) — một luật đọc thời gian cho cả
 * back-office.
 *
 * Hai giá trị null của hàng KHÔNG rơi về cùng một dấu gạch, vì chúng nói hai
 * chuyện khác hẳn nhau: `source` null là "đăng ký thẳng từ form, không qua
 * chiến dịch nào" (hình dạng của MỌI hàng thật hôm nay — web gọi
 * `subscribe({email})` không kèm nguồn), còn `unsubscribedAt` null là "người
 * này VẪN đang nhận thư" — thông tin quan trọng nhất của cả hàng. Một dấu
 * gạch chung cho cả hai đọc thành "thiếu dữ liệu" ở cả hai chỗ.
 */

const t = messages.admin.subscribers.list;

/** Một hàng của bảng `/subscribers`. */
export interface SubscriberRowVM {
  id: string;
  email: string;
  /** Đã rơi về "Direct sign-up" khi hàng không khai nguồn — bảng không rẽ nhánh. */
  source: string;
  subscribed: string;
  /** Mốc rút consent, hoặc "Still subscribed" — cột luôn có chữ. */
  unsubscribed: string;
  /**
   * Còn nhận tin. Nút Unsubscribe CHỈ hiện ở hàng này — và cờ đọc từ
   * `unsubscribedAt` của contract chứ không từ chuỗi đã format ở trên: so
   * chữ hiển thị với một câu i18n là đúng kiểu ràng buộc sẽ đứt im lặng ngày
   * ai đó sửa copy.
   */
  isActive: boolean;
}

/** Row của contract → hàng bảng đã format sẵn (server component gọi). */
export function toSubscriberRowVM(row: SubscriberRow): SubscriberRowVM {
  return {
    id: row.id,
    email: row.email,
    source: row.source ?? t.noSource,
    subscribed: formatDateTime(row.createdAt),
    unsubscribed: row.unsubscribedAt ? formatDateTime(row.unsubscribedAt) : t.stillSubscribed,
    isActive: row.unsubscribedAt === null,
  };
}
