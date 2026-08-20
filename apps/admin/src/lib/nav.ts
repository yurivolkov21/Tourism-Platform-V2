import { messages } from '@tourism/i18n';

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
      { key: 'dashboard', label: t.dashboard, href: '/', enabled: true },
      { key: 'bookings', label: t.bookings, href: '/bookings', enabled: false },
      { key: 'cancellations', label: t.cancellations, href: '/cancellations', enabled: false },
      { key: 'reviews', label: t.reviews, href: '/reviews', enabled: false },
      { key: 'enquiries', label: t.enquiries, href: '/enquiries', enabled: false },
      { key: 'subscribers', label: t.subscribers, href: '/subscribers', enabled: false },
    ],
  },
  {
    key: 'content',
    label: t.groups.content,
    items: [
      { key: 'tours', label: t.tours, href: '/tours', enabled: false },
      { key: 'categories', label: t.categories, href: '/categories', enabled: false },
      { key: 'destinations', label: t.destinations, href: '/destinations', enabled: false },
      { key: 'posts', label: t.posts, href: '/posts', enabled: false },
      { key: 'media', label: t.media, href: '/media', enabled: false },
      { key: 'appearance', label: t.appearance, href: '/appearance', enabled: false },
    ],
  },
  {
    key: 'system',
    label: t.groups.system,
    items: [
      { key: 'outbox', label: t.outbox, href: '/outbox', enabled: false },
      { key: 'payment-events', label: t.paymentEvents, href: '/payment-events', enabled: false },
      { key: 'users', label: t.users, href: '/users', enabled: false },
    ],
  },
];
