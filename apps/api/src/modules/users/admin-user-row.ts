import { type AdminUserDetail, type AdminUserRow, userStatus } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { accountDisplayName } from '../enquiries/enquiry-row.js';

/**
 * Select và mapper của vùng Users (P4f). Thuần — service chỉ đọc DB rồi gọi các hàm này,
 * nên mọi luật hiển thị (trạng thái, cách đăng nhập, lý do khoá, tên người làm) có unit test.
 */

export const ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  emailVerified: true,
  lockedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
export type UserListRow = Prisma.UserGetPayload<{ select: typeof ROW_SELECT }>;

export const DETAIL_SELECT = {
  ...ROW_SELECT,
  phone: true,
  accounts: { select: { providerId: true } },
  _count: { select: { bookings: true, reviews: true, enquiries: true } },
  // Lịch sử MỚI NHẤT trước — `lockReason` lấy dòng LOCKED đầu tiên của danh sách này.
  userEvents: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      type: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  },
} satisfies Prisma.UserSelect;
export type UserDetailRow = Prisma.UserGetPayload<{ select: typeof DETAIL_SELECT }>;

export function toAdminUserRow(row: UserListRow, lastActiveAt: Date | null): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    status: userStatus({ emailVerified: row.emailVerified, lockedAt: row.lockedAt }),
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
  };
}

/** `providerId` của Better Auth → cách đăng nhập in ra màn. Provider khác bị bỏ: không có nhãn. */
const SIGN_IN_METHOD: Record<string, 'password' | 'google'> = {
  credential: 'password',
  google: 'google',
};

export function signInMethods(providerIds: string[]): Array<'password' | 'google'> {
  const found = new Set(
    providerIds.flatMap((providerId) => {
      const method = SIGN_IN_METHOD[providerId];
      return method ? [method] : [];
    }),
  );
  return (['password', 'google'] as const).filter((method) => found.has(method));
}

export function toAdminUserDetail(
  row: UserDetailRow,
  sessions: { active: number; lastActiveAt: Date | null },
): AdminUserDetail {
  const history = row.userEvents.map((event) => ({
    id: event.id,
    type: event.type,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor ? { name: accountDisplayName(event.actor) } : null,
  }));
  return {
    ...toAdminUserRow(row, sessions.lastActiveAt),
    phone: row.phone,
    emailVerified: row.emailVerified,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockReason: row.lockedAt
      ? (history.find((event) => event.type === 'LOCKED')?.note ?? null)
      : null,
    signInMethods: signInMethods(row.accounts.map((account) => account.providerId)),
    counts: {
      bookings: row._count.bookings,
      reviews: row._count.reviews,
      enquiries: row._count.enquiries,
    },
    sessions: {
      active: sessions.active,
      lastActiveAt: sessions.lastActiveAt?.toISOString() ?? null,
    },
    history,
  };
}
