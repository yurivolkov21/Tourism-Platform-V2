import { cookies } from 'next/headers';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { readSidebarOpen, SIDEBAR_STATE_COOKIE, sidebarOpenFromCookie } from './sidebar-state';

/**
 * Trạng thái sidebar sống qua các trang (góp ý giao diện 28/09): mỗi trang vùng tự
 * dựng shell của nó, nên không đọc cookie lúc dựng ở server thì thu gọn rồi chuyển
 * trang là sidebar lại bung ra.
 */
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
const cookiesMock = cookies as unknown as Mock;

beforeEach(() => {
  cookiesMock.mockReset();
});

describe('sidebarOpenFromCookie', () => {
  it('chỉ "false" là thu gọn; vắng cookie hay giá trị lạ là mở', () => {
    expect(sidebarOpenFromCookie('false')).toBe(false);
    expect(sidebarOpenFromCookie('true')).toBe(true);
    expect(sidebarOpenFromCookie(undefined)).toBe(true);
    expect(sidebarOpenFromCookie('nonsense')).toBe(true);
  });
});

describe('readSidebarOpen', () => {
  it('đọc đúng cookie mà SidebarProvider ghi', async () => {
    const get = vi.fn((name: string) =>
      name === SIDEBAR_STATE_COOKIE ? { name, value: 'false' } : undefined,
    );
    cookiesMock.mockResolvedValue({ get });

    await expect(readSidebarOpen()).resolves.toBe(false);
    expect(get).toHaveBeenCalledWith('sidebar_state');
  });

  it('chưa từng đổi (không có cookie) thì mở', async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });

    await expect(readSidebarOpen()).resolves.toBe(true);
  });
});
