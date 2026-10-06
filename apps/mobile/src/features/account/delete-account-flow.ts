import { messages } from '@tourism/i18n';

/**
 * Kết quả gọi `DELETE /api/account` (ADR-0017 §7b) — `status` 0 nghĩa là
 * không tới được server (mất mạng/timeout), `code` là mã trong envelope lỗi
 * của API, thiếu body parse được thì undefined.
 */
export type DeleteAccountResult = { ok: true } | { ok: false; status: number; code?: string };

/** Seam I/O — route tiêm bản thật (`lib/account-api.ts`), test tiêm bản giả. */
export type DeleteAccountAction = (password: string) => Promise<DeleteAccountResult>;

export type DeleteAccountOutcome =
  | { kind: 'done' }
  /** Lỗi thuộc về ô mật khẩu (trống / sai) — hiện ngay dưới ô. */
  | { kind: 'fieldError'; text: string }
  /** Lỗi cấp form — hiện trong khung `FormMessage` của tấm A7. */
  | { kind: 'formError'; text: string };

/**
 * Một lần bấm "Delete account" ở tấm A7 — cùng bảng mã lỗi với
 * `kindOfDeleteError` của web (`components/account/delete-account.tsx`) và
 * dùng LẠI copy `messages.accountProfile.danger.errors` của web: hai bề mặt
 * nói cùng một câu cho cùng một kết cục, không tự chế câu mới.
 *
 * Khác web: KHÔNG có ô gõ chữ "DELETE" — mockup A7 chỉ có ô mật khẩu; tấm
 * trượt + nút đỏ + mật khẩu đã đủ chống bấm nhầm trên điện thoại.
 */
export async function submitDeleteAccount(
  password: string,
  deleteAccount: DeleteAccountAction,
): Promise<DeleteAccountOutcome> {
  if (password.length === 0) {
    return { kind: 'fieldError', text: messages.formErrors.password.required };
  }

  const result = await deleteAccount(password);
  if (result.ok) return { kind: 'done' };

  const danger = messages.accountProfile.danger.errors;
  const shared = messages.accountActionErrors;

  // 401 xét TRƯỚC code: phiên hết hạn giữa chừng thì mọi mã khác vô nghĩa.
  if (result.status === 401) return { kind: 'formError', text: shared.sessionExpired };

  switch (result.code) {
    case 'INVALID_PASSWORD':
      return { kind: 'fieldError', text: danger.wrongPassword };
    case 'TOO_MANY_ATTEMPTS':
      return { kind: 'formError', text: danger.tooManyAttempts };
    case 'ACCOUNT_HAS_PAID_BOOKINGS':
      return { kind: 'formError', text: danger.paidBookings };
    case 'ACCOUNT_HAS_PENDING_CHECKOUT':
      return { kind: 'formError', text: danger.pendingCheckout };
    case 'ACCOUNT_HAS_OPEN_CANCELLATION':
      return { kind: 'formError', text: danger.openCancellation };
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return { kind: 'formError', text: danger.noPassword };
    default:
      // 429 không mang code riêng = trần throttle chung (ADR-0037), không
      // phải trần sai-mật-khẩu của AccountService.
      if (result.status === 429) return { kind: 'formError', text: shared.throttle };
      return { kind: 'formError', text: shared.generic };
  }
}
