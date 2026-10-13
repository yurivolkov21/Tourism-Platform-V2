import type { AdminUserRow, UserRoleValue, UserStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatCalendarDate } from './bookings-view';
import { roleLabel } from './role-label';
import { userDetailHref } from './users-query';

/**
 * Logic THUẦN của vùng Users (P4f): VM của bảng — và của trang chi tiết (Task 11). Component
 * không tự tính gì: mọi con chữ được nấu ở đây.
 */

const t = messages.admin.users;
/** Ô trống dùng chung của back-office — một dấu gạch, không phải chuỗi rỗng. */
const EMPTY = messages.admin.bookings.detail.empty;

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Tên có chữ thì lấy, còn lại là email — cùng luật `accountDisplayName` của API. */
export function userDisplayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email;
}

/**
 * Mốc ISO → "1 Sep 2026" theo UTC. Cắt CHUỖI rồi qua `formatCalendarDate`, không
 * `new Date()`: ngày in ra không được trượt theo múi giờ của máy đang xem. "Lần hoạt động
 * cuối" vốn chỉ chính xác tới ngày (ADR-0052, giới hạn 3) nên không in giờ.
 */
export function formatDay(iso: string | null): string {
  return iso ? formatCalendarDate(iso.slice(0, 10)) : EMPTY;
}

export function userRoleBadgeVariant(role: UserRoleValue): BadgeVariant {
  switch (role) {
    case 'ADMIN':
      return 'default';
    case 'STAFF':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function userStatusLabel(status: UserStatusValue): string {
  return t.status[status];
}

export function userStatusBadgeVariant(status: UserStatusValue): BadgeVariant {
  switch (status) {
    case 'locked':
      return 'destructive';
    case 'unverified':
      return 'secondary';
    default:
      return 'outline';
  }
}

export interface UserRowVM {
  id: string;
  /** Tên hiển thị — rơi về email khi không có tên. */
  name: string;
  email: string;
  image: string | null;
  initial: string;
  /** Trang chi tiết — mang `?back=` về đúng trang bảng đang đứng. */
  href: string;
  role: UserRoleValue;
  roleLabel: string;
  status: UserStatusValue;
  statusLabel: string;
  joined: string;
  lastActive: string;
}

export function toUserRowVM(row: AdminUserRow, listHref: string): UserRowVM {
  const name = userDisplayName(row);
  return {
    id: row.id,
    name,
    email: row.email,
    image: row.image,
    initial: name.slice(0, 1).toUpperCase(),
    href: userDetailHref(row.id, listHref),
    role: row.role,
    roleLabel: roleLabel(row.role),
    status: row.status,
    statusLabel: userStatusLabel(row.status),
    joined: formatDay(row.createdAt),
    lastActive: formatDay(row.lastActiveAt),
  };
}
