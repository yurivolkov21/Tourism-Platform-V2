import { type AdminProcedureKey, canAccess } from '@tourism/contract/admin-access';
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
  /**
   * Thủ tục chính của trang (ADR-0052). Role không gọi được nó thì mục bị ẩn HẲN — không
   * hiện "Soon" (Soon là "sắp có", còn đây là "không dành cho bạn"). Vắng = mọi role vào app.
   */
  access?: AdminProcedureKey;
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
      {
        key: 'reports',
        label: t.reports,
        href: '/reports',
        enabled: true,
        icon: FileBarChart,
        access: 'reports.monthly',
      },
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
      // Vùng thứ hai của P4e (F14) — sáu hàng, không phân trang. Thứ tự ở đây
      // là thứ tự chip lọc trên `/tours` của khách, vì web đọc thẳng
      // `catalog.categories.list`.
      { key: 'categories', label: t.categories, href: '/categories', enabled: true, icon: Tags },
      // Vùng thứ ba của P4e (F15) — ẩn/hiện, và xoá được khi chưa tour nào dùng
      // (ADR-0053). Vùng của từng điểm đến quyết định trang vùng nào của web liệt
      // kê nó.
      {
        key: 'destinations',
        label: t.destinations,
        href: '/destinations',
        enabled: true,
        icon: MapPin,
      },
      // Vùng thứ tư của P4e (P4e-4) — bài viết. Href TRƠN: không có "việc cần làm"
      // mặc định, tab All là câu hỏi thường ngày (bài nào sửa gần nhất).
      { key: 'posts', label: t.posts, href: '/posts', enabled: true, icon: FileText },
      // Mọi ảnh đang dùng và hàng dọn (P4f, ADR-0060) — bậc Staff, cùng bậc sửa bài viết.
      { key: 'media', label: t.media, href: '/media', enabled: true, icon: Image },
      // Ảnh các khe của web (P4f, ADR-0059) — bậc Staff, cùng bậc sửa bài viết.
      {
        key: 'appearance',
        label: t.appearance,
        href: '/appearance',
        enabled: true,
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
        access: 'paymentEvents.list',
      },
      // Vùng Users (P4f, ADR-0052) — chỉ Owner, Staff không thấy mục này.
      {
        key: 'users',
        label: t.users,
        href: '/users',
        enabled: true,
        icon: Users,
        access: 'users.list',
      },
    ],
  },
];

/**
 * Tooltip của một mục khi sidebar thu gọn thành cột icon (góp ý giao diện 28/09):
 * cột ấy không còn chữ, nên tooltip là nhãn DUY NHẤT của icon. Mục chưa mở mất
 * luôn nhãn "Soon" ở cột ấy, nên tooltip của nó phải tự nói "Soon".
 */
export function navTooltip(item: NavItem): string {
  return item.enabled ? item.label : t.soonItem(item.label);
}

/**
 * Mục nào ứng với trang đang mở — ô sáng là dấu duy nhất của trang hiện tại ở cột
 * icon. Bỏ query của href (`/reviews?status=pending`); Dashboard (`/`) chỉ sáng ở
 * đúng `/`, mục khác sáng ở trang của nó và mọi trang con (`/tours/<slug>/…`), so
 * theo đoạn đường có `/` chốt để `/tours-archive` không khớp `/tours`.
 */
export function isActiveNav(href: string, pathname: string): boolean {
  const path = navPath(href);
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Đường của một href nav, bỏ query (`/reviews?status=pending` → `/reviews`). */
export function navPath(href: string): string {
  return href.split('?')[0] ?? href;
}

/** Bản đồ sidebar của MỘT role — mục mà role ấy không gọi được thủ tục chính thì bỏ. */
export function navGroupsFor(role: string): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.access || canAccess(role, item.access)),
  }));
}
