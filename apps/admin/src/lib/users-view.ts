import {
  type AdminUserDetail,
  type AdminUserRow,
  type UserAction,
  type UserRoleValue,
  type UserStatusValue,
  userActions,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { bookingsAccountHref } from './bookings-query';
import { formatCalendarDate, formatDateTime } from './bookings-view';
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

export interface UserHistoryVM {
  id: string;
  /** "Owner Olive locked the account". */
  line: string;
  at: string;
  /** "Reason: …" — chỉ dòng có ghi chú (LOCKED). */
  reason: string | null;
}

export interface UserDetailVM {
  id: string;
  name: string;
  email: string;
  image: string | null;
  initial: string;
  role: UserRoleValue;
  roleLabel: string;
  roleVariant: BadgeVariant;
  status: UserStatusValue;
  statusLabel: string;
  statusVariant: BadgeVariant;
  /** "Joined 1 Sep 2026". */
  joined: string;
  isOwner: boolean;
  /** "Locked since 2 Oct 2026, 03:00 UTC" — null khi không khoá. */
  lockedSince: string | null;
  /** "Reason: …" — null khi không khoá hoặc không đọc được lý do. */
  lockReason: string | null;
  /** Câu của card Access — null với Owner (card ấy không render). */
  accessNote: string | null;
  profile: Array<{ label: string; value: string }>;
  activity: Array<{ label: string; value: string }>;
  /** `/bookings?user=<id>&dates=all` (G45) — null khi chưa có booking nào. */
  bookingsHref: string | null;
  sessions: { count: number; active: string; lastActive: string };
  history: UserHistoryVM[];
  /** Thao tác hợp lệ lúc này — CHÍNH hàm API hỏi trong transaction (`userActions`). */
  actions: UserAction[];
}

const d = t.detail;

function accessNote(detail: AdminUserDetail, actions: UserAction[]): string | null {
  if (detail.role === 'ADMIN') return null;
  if (detail.role === 'STAFF') {
    // Staff đang khoá vẫn mang role STAFF, nhưng hook tạo phiên và AuthGuard cùng chặn họ.
    if (detail.lockedAt) return d.access.staffLocked;
    // Form admin chỉ có email và mật khẩu: Staff chưa có mật khẩu phải đặt một cái trước.
    return detail.signInMethods.includes('password') ? d.access.staff : d.access.staffNoPassword;
  }
  if (actions.includes('grantStaff')) return d.access.customer;
  // Chưa xác minh là điều Owner không tự gỡ được, nên nói nó trước; chỉ khi đã xác minh mà
  // còn khoá thì "mở khoá trước" mới đủ để cấp được.
  return detail.emailVerified ? d.access.needsUnlock : d.access.needsVerified;
}

export function toUserDetailVM(detail: AdminUserDetail): UserDetailVM {
  const row = toUserRowVM(detail, '/users');
  const actions = userActions(detail);
  return {
    id: detail.id,
    name: row.name,
    email: detail.email,
    image: detail.image,
    initial: row.initial,
    role: detail.role,
    roleLabel: row.roleLabel,
    roleVariant: userRoleBadgeVariant(detail.role),
    status: detail.status,
    statusLabel: row.statusLabel,
    statusVariant: userStatusBadgeVariant(detail.status),
    joined: d.joinedOn(row.joined),
    isOwner: detail.role === 'ADMIN',
    lockedSince: detail.lockedAt ? d.lockedSince(formatDateTime(detail.lockedAt)) : null,
    lockReason: detail.lockedAt && detail.lockReason ? t.history.reason(detail.lockReason) : null,
    accessNote: accessNote(detail, actions),
    profile: [
      { label: d.profile.email, value: detail.email },
      { label: d.profile.verified, value: detail.emailVerified ? d.profile.yes : d.profile.no },
      { label: d.profile.phone, value: detail.phone ?? EMPTY },
      {
        label: d.profile.signIn,
        value:
          detail.signInMethods.length > 0
            ? detail.signInMethods.map((method) => d.profile.methods[method]).join(', ')
            : d.profile.noMethod,
      },
    ],
    activity: [
      { label: d.activity.bookings, value: String(detail.counts.bookings) },
      { label: d.activity.reviews, value: String(detail.counts.reviews) },
      { label: d.activity.enquiries, value: String(detail.counts.enquiries) },
    ],
    bookingsHref: detail.counts.bookings > 0 ? bookingsAccountHref(detail.id) : null,
    sessions: {
      count: detail.sessions.active,
      active: String(detail.sessions.active),
      lastActive: formatDay(detail.sessions.lastActiveAt),
    },
    history: detail.history.map((event) => ({
      id: event.id,
      line: t.history.line(
        event.actor?.name ?? t.history.removedActor,
        t.history.actions[event.type],
      ),
      at: formatDateTime(event.createdAt),
      reason: event.note ? t.history.reason(event.note) : null,
    })),
    actions,
  };
}
