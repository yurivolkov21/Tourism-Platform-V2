import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanAccess } from '@/components/admin-access-provider';

/**
 * Lưới cho hai lớp gác GIAO DIỆN của Staff (review P4f) — trước spec này `src/app/**` không có
 * test nào, nên gỡ provider ở layout hay gỡ `requirePageAccess` ở một trang chỉ Owner thì gate
 * vẫn xanh. Gác thật vẫn ở API (`admin-access.int.spec.ts`); ở đây canh phần giao diện:
 * - layout bọc mọi trang bằng `AdminAccessProvider` mang role THẬT của phiên. Vắng provider thì
 *   `useCanAccess` mặc định mở (plan P4f, quyết định 3) và sáu nút chỉ Owner hiện lại cho Staff;
 * - năm trang chỉ Owner đá Staff sang `/not-authorized` TRƯỚC khi gọi API.
 */

type TestSession = { id: string; name: string; email: string; role: string; image: null };

const state = vi.hoisted(() => ({ session: null as TestSession | null }));
const api = vi.hoisted(() => ({
  users: vi.fn(),
  user: vi.fn(),
  report: vi.fn(),
  events: vi.fn(),
  eventStats: vi.fn(),
  activity: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-pathname': '/bookings' }),
  cookies: async () => ({ toString: () => 'better-auth.session_token=test' }),
}));
// `redirect` và `notFound` của Next ném để cắt render; giả lập ném chuỗi đọc được.
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/api/session', () => ({ getServerSession: async () => state.session }));
vi.mock('@/lib/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/users')>()),
  fetchAdminUsers: api.users,
  fetchAdminUser: api.user,
}));
vi.mock('@/lib/api/reports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/reports')>()),
  fetchAdminMonthlyReport: api.report,
}));
vi.mock('@/lib/api/payment-events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/payment-events')>()),
  fetchAdminPaymentEvents: api.events,
}));
vi.mock('@/lib/api/activity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/activity')>()),
  fetchAdminActivity: api.activity,
}));
vi.mock('@/lib/api/stats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/stats')>()),
  fetchAdminPaymentEventsStats: api.eventStats,
}));

const as = (role: string): TestSession => ({
  id: `${role.toLowerCase()}-1`,
  name: role,
  email: `${role.toLowerCase()}@example.com`,
  role,
  image: null,
});
const USER_ID = '11111111-1111-4111-8111-111111111111';
const NO_PARAMS = { searchParams: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  state.session = null;
});

/** Hỏi đúng khoá mà nút Refund hỏi — một trong sáu nút chỉ Owner. */
function RefundProbe() {
  return <span data-testid="probe">{useCanAccess('bookings.refund') ? 'shown' : 'hidden'}</span>;
}

describe('layout (admin) bọc trang bằng role thật của phiên', () => {
  it('Staff: nút chỉ Owner bị ẩn', async () => {
    state.session = as('STAFF');
    const { default: AdminLayout } = await import('./layout');
    render(await AdminLayout({ children: <RefundProbe /> }));
    expect(screen.getByTestId('probe')).toHaveTextContent('hidden');
  });

  it('Owner: nút chỉ Owner hiện (đối chứng — ca Staff không xanh nhờ ẩn tất cả)', async () => {
    state.session = as('ADMIN');
    const { default: AdminLayout } = await import('./layout');
    render(await AdminLayout({ children: <RefundProbe /> }));
    expect(screen.getByTestId('probe')).toHaveTextContent('shown');
  });
});

const OWNER_ONLY_PAGES = [
  {
    path: '/users',
    render: async () => (await import('./users/page')).default(NO_PARAMS),
    fetches: [api.users],
  },
  {
    path: '/users/[id]',
    render: async () =>
      (await import('./users/[id]/page')).default({
        params: Promise.resolve({ id: USER_ID }),
        ...NO_PARAMS,
      }),
    fetches: [api.user],
  },
  {
    path: '/reports',
    render: async () => (await import('./reports/page')).default(NO_PARAMS),
    fetches: [api.report],
  },
  {
    path: '/payment-events',
    render: async () => (await import('./payment-events/page')).default(NO_PARAMS),
    fetches: [api.events, api.eventStats],
  },
  {
    path: '/activity',
    render: async () => (await import('./activity/page')).default(NO_PARAMS),
    fetches: [api.activity],
  },
];

describe('năm trang chỉ Owner chặn Staff trước khi gọi API (plan P4f, quyết định 13)', () => {
  it.each(OWNER_ONLY_PAGES)('$path: Staff → /not-authorized, không gọi API', async (page) => {
    state.session = as('STAFF');
    await expect(page.render()).rejects.toThrow('REDIRECT /not-authorized');
    for (const fetch of page.fetches) expect(fetch).not.toHaveBeenCalled();
  });

  it.each(OWNER_ONLY_PAGES)('$path: Owner → gọi API (đối chứng cho ca Staff)', async (page) => {
    state.session = as('ADMIN');
    // Mock trả `undefined` nên trang có thể ném SAU lời gọi — điều cần đo chỉ là đã gọi.
    await page.render().catch(() => undefined);
    expect(page.fetches.some((fetch) => fetch.mock.calls.length > 0)).toBe(true);
  });
});
