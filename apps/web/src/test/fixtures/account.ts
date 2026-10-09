import type { SessionUser } from '@/lib/api/session';

/**
 * Fixture `SessionUser` cho test khu Settings (`/account/settings`) — trước đây mỗi spec chép tay
 * một bản `PROFILE`. Mặc định: khách có tên, có số điện thoại, chưa có ảnh đại diện.
 */
export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    name: 'Minh Anh',
    email: 'minh.anh@example.com',
    role: 'CUSTOMER',
    phone: '0901234567',
    image: null,
    ...overrides,
  };
}
