import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import { requirePageAccess } from './admin-access';

describe('requirePageAccess', () => {
  beforeEach(() => {
    redirect.mockReset();
  });

  it('Staff mở trang chỉ Owner → /not-authorized', () => {
    requirePageAccess({ role: 'STAFF' }, 'reports.monthly');
    expect(redirect).toHaveBeenCalledWith('/not-authorized');
  });

  it('Staff ở trang staff, Owner ở mọi trang → không chuyển hướng', () => {
    requirePageAccess({ role: 'STAFF' }, 'bookings.list');
    requirePageAccess({ role: 'ADMIN' }, 'users.list');
    expect(redirect).not.toHaveBeenCalled();
  });
});
