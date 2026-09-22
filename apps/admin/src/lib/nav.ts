import { messages } from '@tourism/i18n';
import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  CreditCard,
  FileBarChart,
  FileText,
  Image,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageSquare,
  Palette,
  Send,
  Star,
  Tags,
  Ticket,
  Users,
} from 'lucide-react';

/**
 * Bản đồ sidebar (spec P4a §3) — phủ đủ 18 vùng của khảo sát 20/08 trong 15
 * mục hiển thị: departures nằm LỒNG dưới tours (như bản cũ — trang con
 * `/tours/[slug]/departures`), uploads là hạ tầng không có trang riêng,
 * users/me gộp vào nav-user ở topbar.
 * `enabled: false` → mục "soon", disabled, KHÔNG phải link chết (nghiệm thu
 * §0.3); các phase P4b–P4f bật dần từng mục.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
  /** Icon lucide hiển thị cạnh nhãn (shell dashboard-01, vòng gọt 21/08). */
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const t = messages.admin.shell;

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    label: t.groups.operations,
    items: [
      { key: 'dashboard', label: t.dashboard, href: '/', enabled: true, icon: LayoutDashboard },
      // Vùng thật đầu tiên đã có dữ liệu (P4b F1) — header tự đổi theo trang.
      { key: 'bookings', label: t.bookings, href: '/bookings', enabled: true, icon: Ticket },
      // Vùng thật thứ ba (P4b F4) — hàng đợi moderation + duyệt/bỏ duyệt.
      {
        key: 'reviews',
        label: t.reviews,
        // Mở thẳng phần CHỜ DUYỆT (việc cần làm), không phải cả kho review đã
        // duyệt từ đời nào; tab "All" trong trang vẫn xem được tất cả — cùng
        // nếp `/outbox?status=FAILED`. Header khớp tiêu đề theo
        // PATHNAME nên query ở đây không làm lệch chữ trên thanh trên cùng.
        href: '/reviews?status=pending',
        enabled: true,
        icon: Star,
      },
      // Báo cáo tháng (P4b F6) — nhóm Operations, cạnh ba vùng nó tổng hợp.
      // Href mang sẵn `?month=` KHÔNG được: "tháng hiện tại" phải do trang tự
      // tính lúc mở, còn một href cứng sẽ hoá cũ ngay đầu tháng sau.
      { key: 'reports', label: t.reports, href: '/reports', enabled: true, icon: FileBarChart },
      // Vùng thật thứ ba của P4c (F9) — CRM lead. Mở thẳng hàng NEW (việc
      // cần làm: lead chưa ai chạm tới), cùng nếp `/reviews?status=pending`
      // và `/outbox?status=FAILED`; tab "All" trong trang vẫn xem được tất cả.
      {
        key: 'enquiries',
        label: t.enquiries,
        href: '/enquiries?status=NEW',
        enabled: true,
        icon: MessageSquare,
      },
      // Vùng thứ tư (và cuối) của P4c — F10, danh sách nhận tin. Đường trơn
      // = tab Active (mặc định nằm ở `parseSubscribersSearchParams`, vòng vá
      // review F10): danh sách đang thật sự nhận thư là câu hỏi thường ngày,
      // còn "ai vừa rời đi"/All là tab trong trang. Chuỗi literal như mọi mục
      // khác — nav là chunk client dùng chung, không kéo lib của vùng (và qua
      // nó cả barrel contract) vào đây chỉ để đọc một hằng.
      {
        key: 'subscribers',
        label: t.subscribers,
        href: '/subscribers',
        enabled: true,
        icon: Mail,
      },
    ],
  },
  {
    key: 'content',
    label: t.groups.content,
    items: [
      // Vùng thật đầu tiên của P4e (F11) — bảng catalogue + công tắc đăng.
      // Href TRƠN (không `?published=false` kiểu `/outbox?status=FAILED`):
      // vùng này không có "việc cần làm" mặc định nào, và tab "All tours" là
      // câu hỏi thường ngày — xem tour nào đang chạy, chuyến nào sắp tới.
      { key: 'tours', label: t.tours, href: '/tours', enabled: true, icon: Compass },
      // Vùng thứ hai của P4e (F14) — sáu hàng, không phân trang.
      // (Thứ tự ở đây CHƯA phải thứ tự chip lọc trên `/tours` của khách: web vẫn
      // suy chip từ danh sách tour. Task 5 cùng nhánh nối web vào endpoint này.)
      { key: 'categories', label: t.categories, href: '/categories', enabled: true, icon: Tags },
      {
        key: 'destinations',
        label: t.destinations,
        href: '/destinations',
        enabled: false,
        icon: MapPin,
      },
      { key: 'posts', label: t.posts, href: '/posts', enabled: false, icon: FileText },
      { key: 'media', label: t.media, href: '/media', enabled: false, icon: Image },
      {
        key: 'appearance',
        label: t.appearance,
        href: '/appearance',
        enabled: false,
        icon: Palette,
      },
    ],
  },
  {
    key: 'system',
    label: t.groups.system,
    items: [
      // Vùng thật đầu tiên của P4c (F7) — mở thẳng hàng FAILED (việc cần
      // người), cùng nếp `/reviews?status=pending`; tab "All" trong
      // trang vẫn xem được tất cả.
      {
        key: 'outbox',
        label: t.outbox,
        href: '/outbox?status=FAILED',
        enabled: true,
        icon: Send,
      },
      // Vùng thật thứ hai của P4c (F8) — sổ sự kiện tiền, hoàn toàn đọc; không có
      // "việc cần làm" mặc định nên href trơn (tab All), toggle Unprocessed
      // trong trang lọc phần cần soi.
      {
        key: 'payment-events',
        label: t.paymentEvents,
        href: '/payment-events',
        enabled: true,
        icon: CreditCard,
      },
      { key: 'users', label: t.users, href: '/users', enabled: false, icon: Users },
    ],
  },
];
