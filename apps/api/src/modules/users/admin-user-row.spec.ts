import { AdminUserDetailSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { signInMethods, toAdminUserDetail, type UserDetailRow } from './admin-user-row.js';

const CREATED = new Date('2026-09-01T08:00:00.000Z');
const LOCKED = new Date('2026-10-02T03:00:00.000Z');
const LAST = new Date('2026-10-01T09:30:00.000Z');

function row(patch: Partial<UserDetailRow> = {}): UserDetailRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    role: 'CUSTOMER',
    emailVerified: true,
    lockedAt: null,
    createdAt: CREATED,
    phone: null,
    accounts: [{ providerId: 'credential' }],
    _count: { bookings: 2, reviews: 1, enquiries: 0 },
    userEvents: [],
    ...patch,
  };
}

function event(
  id: string,
  type: UserDetailRow['userEvents'][number]['type'],
  note: string | null,
  createdAt: Date,
  actor: { name: string | null; email: string } | null = { name: 'Owner Olive', email: 'o@x.com' },
): UserDetailRow['userEvents'][number] {
  return { id, type, note, createdAt, actor };
}

describe('signInMethods', () => {
  it('credential là mật khẩu; thứ tự cố định mật khẩu trước Google; provider lạ bị bỏ', () => {
    expect(signInMethods(['google', 'credential', 'github', 'google'])).toEqual([
      'password',
      'google',
    ]);
    expect(signInMethods([])).toEqual([]);
  });
});

describe('toAdminUserDetail', () => {
  it('khớp schema contract; mốc giờ là ISO; phiên lấy từ tham số', () => {
    const detail = toAdminUserDetail(row(), { active: 2, lastActiveAt: LAST });
    expect(AdminUserDetailSchema.parse(detail)).toEqual(detail);
    expect(detail).toMatchObject({
      createdAt: '2026-09-01T08:00:00.000Z',
      lastActiveAt: '2026-10-01T09:30:00.000Z',
      sessions: { active: 2, lastActiveAt: '2026-10-01T09:30:00.000Z' },
      counts: { bookings: 2, reviews: 1, enquiries: 0 },
      signInMethods: ['password'],
      status: 'active',
      lockReason: null,
    });
  });

  it('đang khoá: lockReason là ghi chú của dòng LOCKED MỚI NHẤT (lịch sử đã sắp mới trước)', () => {
    const detail = toAdminUserDetail(
      row({
        lockedAt: LOCKED,
        userEvents: [
          event('e3', 'LOCKED', 'Second lock', LOCKED),
          event('e2', 'UNLOCKED', null, new Date('2026-10-01T00:00:00.000Z')),
          event('e1', 'LOCKED', 'First lock', new Date('2026-09-30T00:00:00.000Z')),
        ],
      }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.status).toBe('locked');
    expect(detail.lockedAt).toBe('2026-10-02T03:00:00.000Z');
    expect(detail.lockReason).toBe('Second lock');
  });

  it('không khoá: lockReason null dù lịch sử còn dòng LOCKED cũ', () => {
    const detail = toAdminUserDetail(
      row({ userEvents: [event('e1', 'LOCKED', 'Old reason', LOCKED)] }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.lockReason).toBeNull();
  });

  it('tên người làm: tên có chữ thì lấy, rỗng thì email; tài khoản người làm đã mất → null', () => {
    const detail = toAdminUserDetail(
      row({
        userEvents: [
          event('e3', 'STAFF_GRANTED', null, LAST, { name: '  ', email: 'blank@x.com' }),
          event('e2', 'SESSIONS_REVOKED', null, LAST, null),
          event('e1', 'UNLOCKED', null, LAST),
        ],
      }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.history.map((item) => item.actor)).toEqual([
      { name: 'blank@x.com' },
      null,
      { name: 'Owner Olive' },
    ]);
  });
});
