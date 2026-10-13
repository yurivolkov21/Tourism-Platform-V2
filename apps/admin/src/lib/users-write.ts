import type {
  AdminUserByIdInput,
  AdminUserLockInput,
  AdminUserSetRoleInput,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của bốn lệnh ghi vùng Users (P4f) — cùng khuôn `subscribers-unsubscribe.ts`:
 * codec lỗi suy từ khối i18n, hợp đồng vận chuyển của server action, dòng ngữ cảnh dialog.
 */
const t = messages.admin.users;

/**
 * CẢ HAI mã contract là trạng-thái-cũ: tài khoản biến mất, hoặc trạng thái đã đổi dưới chân
 * dialog (tab khác vừa khoá, vừa thu Staff). Đóng dialog, toast, kéo trang tươi về — bấm lại
 * tại chỗ chỉ ra 409 y như cũ.
 */
const codec = createWriteErrorCodec(t.errors, { stale: ['NOT_FOUND', 'STATE_CHANGED'] });

export const USER_WRITE_CONTRACT_CODES = codec.codes;
export type UserWriteContractCode = keyof typeof t.errors;
export type UserWriteFailureCode = UserWriteContractCode | TransportFailureCode;

export const classifyUserWriteError = codec.classify;
export const userWriteErrorCopy = codec.copy;
export const isUserWriteStale = codec.isStale;

type Failure = { ok: false; code: UserWriteFailureCode };

/** Kết quả server action — sống ở lib để tầng server không import tầng trình bày. */
export type SetUserRoleActionResult = { ok: true; role: 'CUSTOMER' | 'STAFF' } | Failure;
export type LockUserActionResult = { ok: true; lockedAt: string } | Failure;
export type UnlockUserActionResult = { ok: true } | Failure;
export type RevokeUserSessionsActionResult = { ok: true; revoked: number } | Failure;

export type SetUserRoleAction = (input: AdminUserSetRoleInput) => Promise<SetUserRoleActionResult>;
export type LockUserAction = (input: AdminUserLockInput) => Promise<LockUserActionResult>;
export type UnlockUserAction = (input: AdminUserByIdInput) => Promise<UnlockUserActionResult>;
export type RevokeUserSessionsAction = (
  input: AdminUserByIdInput,
) => Promise<RevokeUserSessionsActionResult>;

/** Bốn server action trang truyền xuống — component không tự import đường server nào. */
export interface UserDetailActions {
  setRole: SetUserRoleAction;
  lock: LockUserAction;
  unlock: UnlockUserAction;
  revokeSessions: RevokeUserSessionsAction;
}

/** Hai dòng ngữ cảnh của mọi hộp xác nhận: lệnh nào cũng nhắm ĐÚNG một người. */
export function userConfirmRows(detail: { name: string; email: string }) {
  return [
    { label: t.actions.rows.user, value: detail.name },
    { label: t.actions.rows.email, value: detail.email },
  ];
}
