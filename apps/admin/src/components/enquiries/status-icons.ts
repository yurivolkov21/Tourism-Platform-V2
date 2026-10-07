import type { EnquiryStatusValue } from '@tourism/contract';
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  type LucideIcon,
  PhoneCallIcon,
  ReceiptTextIcon,
} from 'lucide-react';

/**
 * Icon theo trạng thái enquiry — `Record` trên enum để quên một member là đỏ ở typecheck. Ba
 * trạng thái đang mở kể tiến độ (chưa chạm · đã gọi · đã báo giá), hai trạng thái chung cuộc là
 * tích và gạch chéo. Dải tab của `/enquiries` và ô đổi trạng thái của `/enquiries/[id]` dùng
 * chung — một trạng thái, một icon ở mọi chỗ.
 *
 * Module LÁ, chỉ import icon (review EF3): bảng này từng nằm trong `enquiries-toolbar.tsx`, nên
 * trang chi tiết tra năm icon là kéo luôn `status-filter-tabs` → `motion/react` và ToggleGroup
 * (~47 KB gzip) dù trang không có dải tab nào.
 */
export const ENQUIRY_STATUS_ICONS: Record<EnquiryStatusValue, LucideIcon> = {
  NEW: CircleDashedIcon,
  CONTACTED: PhoneCallIcon,
  QUOTED: ReceiptTextIcon,
  WON: CircleCheckIcon,
  LOST: CircleSlashIcon,
};
