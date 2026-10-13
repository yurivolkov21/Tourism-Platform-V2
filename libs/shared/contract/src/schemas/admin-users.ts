import { z } from 'zod';
import { PagedSchema } from './catalog.js';
import { AdminPageQuerySchema } from './common.js';

/**
 * Vùng Users của admin (P4f, ADR-0052) — hằng, enum, hai hàm thuần mà API và admin cùng
 * gọi, và schema của sáu thủ tục `admin.users.*`.
 */

/** Trần lý do khoá — cột `user_events.note VarChar(500)`. */
export const USER_LOCK_REASON_MAX = 500;
/** Trần ô tìm tên/email — cùng trần của bookings, enquiries, subscribers. */
export const USER_SEARCH_MAX = 120;

/**
 * Gương enum Prisma `UserRole`, ĐÚNG thứ tự của DB: `STAFF` nối đuôi vì
 * `ALTER TYPE … ADD VALUE` không chèn giữa (plan P4f, quyết định 1). `ADMIN` là Owner —
 * enum giữ tên cũ, giao diện mới gọi là Owner.
 */
export const UserRoleSchema = z.enum(['CUSTOMER', 'ADMIN', 'STAFF']);
export type UserRoleValue = z.output<typeof UserRoleSchema>;

/** Trạng thái HIỂN THỊ — suy bằng `userStatus`, không có cột riêng. */
export const UserStatusSchema = z.enum(['active', 'locked', 'unverified']);
export type UserStatusValue = z.output<typeof UserStatusSchema>;

/** Gương enum Prisma `UserEventType` — năm việc Owner làm được với một tài khoản. */
export const UserEventTypeSchema = z.enum([
  'STAFF_GRANTED',
  'STAFF_REVOKED',
  'LOCKED',
  'UNLOCKED',
  'SESSIONS_REVOKED',
]);
export type UserEventTypeValue = z.output<typeof UserEventTypeSchema>;

export type UserAction = 'grantStaff' | 'revokeStaff' | 'lock' | 'unlock' | 'revokeSessions';

export interface UserStatusInput {
  emailVerified: boolean;
  lockedAt: Date | string | null;
}

/** Khoá thắng mọi thứ; còn lại là chuyện đã xác minh email hay chưa. */
export function userStatus({ emailVerified, lockedAt }: UserStatusInput): UserStatusValue {
  if (lockedAt != null) return 'locked';
  return emailVerified ? 'active' : 'unverified';
}

export interface UserActionTarget extends UserStatusInput {
  role: UserRoleValue;
}

/**
 * Thao tác hợp lệ với MỘT tài khoản lúc này (spec §4.1) — nguồn duy nhất của luật: API hỏi
 * hàm này trong transaction, trang chi tiết hỏi nó để chọn nút. Owner không bao giờ là mục
 * tiêu (SEC-1 giữ nguyên: quyền Owner chỉ đến từ `ADMIN_EMAILS`), trừ mở khoá — ca hiếm khi
 * email của một khách đang bị khoá được thêm vào `ADMIN_EMAILS`.
 */
export function userActions(target: UserActionTarget): UserAction[] {
  const locked = target.lockedAt != null;
  if (target.role === 'ADMIN') return locked ? ['unlock'] : [];
  const actions: UserAction[] = [];
  if (target.role === 'STAFF') actions.push('revokeStaff');
  if (target.role === 'CUSTOMER' && target.emailVerified && !locked) actions.push('grantStaff');
  actions.push(locked ? 'unlock' : 'lock', 'revokeSessions');
  return actions;
}

/** Ba tab của `/users`: mọi tài khoản · chỉ Staff · chỉ tài khoản đang khoá. */
export const AdminUsersViewSchema = z.enum(['all', 'staff', 'locked']);
export type AdminUsersView = z.output<typeof AdminUsersViewSchema>;

export const AdminUsersListQuerySchema = AdminPageQuerySchema.extend({
  view: AdminUsersViewSchema.default('all'),
  /** Khớp tên HOẶC email, không phân biệt hoa thường. */
  search: z.string().trim().min(1).max(USER_SEARCH_MAX).optional(),
});
export type AdminUsersListQuery = z.output<typeof AdminUsersListQuerySchema>;

/** Một hàng của `/users`. Tài khoản đã xoá (tombstone) không bao giờ có mặt. */
export const AdminUserRowSchema = z.object({
  id: z.uuid(),
  name: z.string().max(120).nullable(),
  /**
   * Không trần, đúng như cột citext: trần nằm ở đường ghi (hook `user.create` của
   * `auth.config.ts`, 254). Output chặt hơn cột không chặn được gì, chỉ biến một hàng cũ
   * thành 500 cho cả trang (review P4f).
   */
  email: z.string().min(1),
  image: z.string().max(500).nullable(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  createdAt: z.iso.datetime(),
  /** `max(sessions.updated_at)` — Better Auth gia hạn phiên tối đa một lần mỗi ngày. */
  lastActiveAt: z.iso.datetime().nullable(),
});
export type AdminUserRow = z.output<typeof AdminUserRowSchema>;

export const AdminUsersListResultSchema = PagedSchema(AdminUserRowSchema);

/** Một dòng lịch sử. `actor` null khi tài khoản của người làm đã bị xoá (SetNull). */
export const UserEventSchema = z.object({
  id: z.uuid(),
  type: UserEventTypeSchema,
  /** Chỉ dòng LOCKED mang chữ: lý do khoá. */
  note: z.string().max(USER_LOCK_REASON_MAX).nullable(),
  createdAt: z.iso.datetime(),
  actor: z.object({ name: z.string().min(1).max(320) }).nullable(),
});
export type UserEventItem = z.output<typeof UserEventSchema>;

export const AdminUserDetailSchema = AdminUserRowSchema.extend({
  phone: z.string().max(30).nullable(),
  emailVerified: z.boolean(),
  lockedAt: z.iso.datetime().nullable(),
  /** Ghi chú của dòng LOCKED mới nhất khi ĐANG khoá; không khoá thì null. */
  lockReason: z.string().max(USER_LOCK_REASON_MAX).nullable(),
  signInMethods: z.array(z.enum(['password', 'google'])),
  counts: z.object({
    bookings: z.int().nonnegative(),
    reviews: z.int().nonnegative(),
    enquiries: z.int().nonnegative(),
  }),
  sessions: z.object({
    /** Phiên `expires_at > now`. */
    active: z.int().nonnegative(),
    lastActiveAt: z.iso.datetime().nullable(),
  }),
  /** Mọi dòng `user_events`, MỚI NHẤT trước. */
  history: z.array(UserEventSchema),
});
export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;

/** Input của `byId`, `unlock`, `revokeSessions` — server action admin re-parse bằng chính schema này. */
export const AdminUserByIdInputSchema = z.object({ id: z.uuid() });
export type AdminUserByIdInput = z.output<typeof AdminUserByIdInputSchema>;

/** Chỉ hai đích: giao diện không bao giờ đặt được ADMIN (SEC-1). */
const SettableRoleSchema = z.enum(['CUSTOMER', 'STAFF']);

export const AdminUserSetRoleInputSchema = z.object({ id: z.uuid(), role: SettableRoleSchema });
export type AdminUserSetRoleInput = z.output<typeof AdminUserSetRoleInputSchema>;
export const AdminUserSetRoleResultSchema = z.object({ id: z.uuid(), role: SettableRoleSchema });
export type AdminUserSetRoleResult = z.output<typeof AdminUserSetRoleResultSchema>;

export const AdminUserLockInputSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1).max(USER_LOCK_REASON_MAX),
});
export type AdminUserLockInput = z.output<typeof AdminUserLockInputSchema>;
export const AdminUserLockResultSchema = z.object({ id: z.uuid(), lockedAt: z.iso.datetime() });
export type AdminUserLockResult = z.output<typeof AdminUserLockResultSchema>;

export const AdminUserUnlockResultSchema = z.object({ id: z.uuid() });
export type AdminUserUnlockResult = z.output<typeof AdminUserUnlockResultSchema>;

export const AdminUserRevokeSessionsResultSchema = z.object({
  id: z.uuid(),
  /** Số phiên vừa xoá — 0 vẫn là thành công. */
  revoked: z.int().nonnegative(),
});
export type AdminUserRevokeSessionsResult = z.output<typeof AdminUserRevokeSessionsResultSchema>;
