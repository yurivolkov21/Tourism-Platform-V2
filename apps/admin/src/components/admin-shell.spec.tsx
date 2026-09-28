import { cookies } from 'next/headers';
import { describe, expect, it, type Mock, vi } from 'vitest';
import type { SessionUser } from '@/lib/api/session';
import { AdminShell } from './admin-shell';

/**
 * Khung trang của các vùng (góp ý giao diện 28/09): thu gọn sidebar rồi chuyển trang
 * thì sidebar phải GIỮ trạng thái — mỗi trang vùng tự dựng shell này, nên nó đọc
 * cookie `sidebar_state` lúc dựng ở server.
 */
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
const cookiesMock = cookies as unknown as Mock;

const USER: SessionUser = {
  id: 'u-1',
  name: 'Admin Nexora',
  email: 'admin@nexora.test',
  role: 'ADMIN',
  image: null,
};

const withCookie = (value: string | undefined) =>
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === 'sidebar_state' && value !== undefined ? { name, value } : undefined,
  });

describe('AdminShell', () => {
  it('cookie "false" → trang dựng với sidebar thu gọn', async () => {
    withCookie('false');
    const shell = await AdminShell({ user: USER, children: null });
    expect(shell.props.defaultOpen).toBe(false);
  });

  it('chưa có cookie → sidebar mở', async () => {
    withCookie(undefined);
    const shell = await AdminShell({ user: USER, children: null });
    expect(shell.props.defaultOpen).toBe(true);
  });
});
