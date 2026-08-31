import { messages } from '@tourism/i18n';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarX2,
  Compass,
  CreditCard,
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
      // Vùng thật thứ hai (P4b F3) — hàng đợi cancellation + quyết định.
      {
        key: 'cancellations',
        label: t.cancellations,
        href: '/cancellations',
        enabled: true,
        icon: CalendarX2,
      },
      { key: 'reviews', label: t.reviews, href: '/reviews', enabled: false, icon: Star },
      {
        key: 'enquiries',
        label: t.enquiries,
        href: '/enquiries',
        enabled: false,
        icon: MessageSquare,
      },
      {
        key: 'subscribers',
        label: t.subscribers,
        href: '/subscribers',
        enabled: false,
        icon: Mail,
      },
    ],
  },
  {
    key: 'content',
    label: t.groups.content,
    items: [
      { key: 'tours', label: t.tours, href: '/tours', enabled: false, icon: Compass },
      { key: 'categories', label: t.categories, href: '/categories', enabled: false, icon: Tags },
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
      { key: 'outbox', label: t.outbox, href: '/outbox', enabled: false, icon: Send },
      {
        key: 'payment-events',
        label: t.paymentEvents,
        href: '/payment-events',
        enabled: false,
        icon: CreditCard,
      },
      { key: 'users', label: t.users, href: '/users', enabled: false, icon: Users },
    ],
  },
];
