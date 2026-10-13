import type { AdminUserDetail } from '@tourism/contract';

/** Một khách đã xác minh, không khoá, có booking và một phiên — patch cho từng ca. */
export const USER_ID = '11111111-1111-4111-8111-111111111111';

export function userDetailFixture(patch: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: USER_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    role: 'CUSTOMER',
    status: 'active',
    createdAt: '2026-09-01T08:00:00.000Z',
    lastActiveAt: '2026-10-01T09:30:00.000Z',
    phone: null,
    emailVerified: true,
    lockedAt: null,
    lockReason: null,
    signInMethods: ['password'],
    counts: { bookings: 2, reviews: 1, enquiries: 0 },
    sessions: { active: 1, lastActiveAt: '2026-10-01T09:30:00.000Z' },
    history: [],
    ...patch,
  };
}
