import type { AnyContractProcedure } from '@orpc/contract';
import type { contract } from './contract.js';

/**
 * Bảng quyền admin (ADR-0052 §2) — MỘT nguồn cho API (`@AdminImplement`) và app admin
 * (sidebar, nút, trang chỉ Owner).
 *
 * Module này chỉ `import type`: app admin đọc nó qua subpath `@tourism/contract/admin-access`
 * từ chunk client của sidebar, nên nó không được kéo barrel contract (zod, mọi schema) theo.
 */

/** Đường của mọi thủ tục dưới một cây router, dạng `'bookings.refund'`. */
type ProcedurePaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends AnyContractProcedure
    ? `${Prefix}${K}`
    : ProcedurePaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Khoá của MỘT thủ tục `contract.admin.*`. */
export type AdminProcedureKey = ProcedurePaths<(typeof contract)['admin']>;

/** `owner` = chỉ Owner (role ADMIN); `staff` = Staff và Owner. */
export type AdminAccessLevel = 'owner' | 'staff';

/** Role được vào app admin. `ADMIN` là Owner — enum giữ tên cũ (ADR-0052 §1). */
export const ADMIN_APP_ROLES = ['ADMIN', 'STAFF'] as const;
export type AdminAppRole = (typeof ADMIN_APP_ROLES)[number];

/**
 * Mỗi thủ tục admin một dòng. `satisfies` bắt cả hai chiều: thiếu một thủ tục hay thừa một
 * khoá không tồn tại là typecheck đỏ — thêm thủ tục admin mới là PHẢI quyết quyền của nó.
 * Thứ tự theo `contract.admin`.
 */
export const ADMIN_ACCESS = {
  'bookings.list': 'staff',
  'bookings.byCode': 'staff',
  'bookings.refund': 'owner',
  'reviews.list': 'staff',
  'reviews.moderate': 'staff',
  'stats.bookings': 'staff',
  'stats.reviews': 'staff',
  'stats.outbox': 'staff',
  'stats.paymentEvents': 'owner',
  'stats.enquiries': 'staff',
  'stats.subscribers': 'staff',
  'stats.dashboard': 'staff',
  'outbox.list': 'staff',
  'outbox.retry': 'staff',
  'paymentEvents.list': 'owner',
  'paymentEvents.byId': 'owner',
  'enquiries.list': 'staff',
  'enquiries.byId': 'staff',
  'enquiries.setStatus': 'staff',
  'enquiries.addNote': 'staff',
  'subscribers.list': 'staff',
  'subscribers.unsubscribe': 'staff',
  'reports.monthly': 'owner',
  'tours.list': 'staff',
  'tours.get': 'staff',
  'tours.create': 'staff',
  'tours.updateDetails': 'staff',
  'tours.setItinerary': 'staff',
  'tours.setFaqsPolicies': 'staff',
  'tours.setCosts': 'staff',
  'tours.setPhotos': 'staff',
  'tours.signPhotoUploads': 'staff',
  'tours.photoLibrary': 'staff',
  'tours.delete': 'owner',
  'tours.setPublished': 'staff',
  'categories.list': 'staff',
  'categories.create': 'staff',
  'categories.update': 'staff',
  'categories.setActive': 'staff',
  'categories.move': 'staff',
  'categories.delete': 'owner',
  'destinations.list': 'staff',
  'destinations.create': 'staff',
  'destinations.update': 'staff',
  'destinations.setActive': 'staff',
  'destinations.delete': 'owner',
  'destinations.photos': 'staff',
  'destinations.setPhotos': 'staff',
  'destinations.signPhotoUploads': 'staff',
  'departures.list': 'staff',
  'departures.create': 'staff',
  'departures.update': 'staff',
  'departures.cancel': 'owner',
  'departures.setStatus': 'staff',
  'posts.list': 'staff',
  'posts.get': 'staff',
  'posts.create': 'staff',
  'posts.update': 'staff',
  'posts.delete': 'owner',
  'posts.signCoverUpload': 'staff',
  'posts.tags': 'staff',
  'appearance.list': 'staff',
  'appearance.signUpload': 'staff',
  'appearance.setSlot': 'staff',
  'media.list': 'staff',
  'media.update': 'staff',
  'media.queue': 'staff',
  'users.list': 'owner',
  'users.byId': 'owner',
  'users.setRole': 'owner',
  'users.lock': 'owner',
  'users.unlock': 'owner',
  'users.revokeSessions': 'owner',
} as const satisfies Record<AdminProcedureKey, AdminAccessLevel>;

export function isAdminAppRole(role: string): role is AdminAppRole {
  return (ADMIN_APP_ROLES as readonly string[]).includes(role);
}

/**
 * Role này có gọi được thủ tục này không. So BẰNG chuỗi, không hạ hoa thường; role lạ hay
 * rỗng là `false` — cùng tinh thần fail-closed của ADR-0003.
 */
export function canAccess(role: string, key: AdminProcedureKey): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'STAFF') return ADMIN_ACCESS[key] === 'staff';
  return false;
}
