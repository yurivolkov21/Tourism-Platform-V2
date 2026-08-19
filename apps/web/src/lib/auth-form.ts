import {
  CreateBookingInputSchema,
  CreateEnquiryInputSchema,
  EmailSchema,
  PasswordSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Validate CLIENT cho cụm auth + hồ sơ tài khoản (sweep bắt lỗi form 19/08).
 *
 * Trước sweep, các form này không kiểm gì ở client: bấm submit trống → gọi
 * Better Auth → 400 → `mapAuthError` gom thành "Something went wrong". Khách
 * không biết ô nào sai. Hàm ở đây THUẦN (không gọi API, không state) để TDD
 * riêng, cùng khuôn `validateEnquiry`/`validateNewsletterEmail`: dùng CHÍNH
 * schema contract (`EmailSchema`, `PasswordSchema` soi gương ngưỡng Better
 * Auth 8–128) thay vì khai lại rule, rồi tự soi giá trị thô để chọn copy
 * "required" vs "invalid"/"tooShort" — zod báo `too_small` cho cả hai.
 *
 * Nguyên tắc: client chỉ bắt thứ nó BIẾT CHẮC (trống, sai định dạng, ngoài
 * ngưỡng độ dài). Đúng/sai mật khẩu, email đã tồn tại… là việc của server —
 * `mapAuthError` + `fieldOfAuthError` lo phần đó.
 */

const t = messages.formErrors;

/** Không kiểm ngưỡng — chỉ "có hay không" (login/currentPassword). */
function requiredOnly(value: string, copy: string): string | undefined {
  return value.length === 0 ? copy : undefined;
}

function emailError(raw: string): string | undefined {
  const email = raw.trim();
  if (email.length === 0) return t.email.required;
  return EmailSchema.safeParse(email).success ? undefined : t.email.invalid;
}

/**
 * Mật khẩu MỚI (register/reset/change): trống → required, rồi ngưỡng 8–128
 * theo `PasswordSchema`. KHÔNG trim — khoảng trắng là ký tự hợp lệ của mật
 * khẩu và server cũng không trim.
 */
function newPasswordError(
  password: string,
  copy: { required: string; tooShort: string; tooLong: string },
): string | undefined {
  if (password.length === 0) return copy.required;
  if (PasswordSchema.safeParse(password).success) return undefined;
  return password.length < 8 ? copy.tooShort : copy.tooLong;
}

function confirmError(password: string, confirm: string): string | undefined {
  if (confirm.length === 0) return t.confirmPassword.required;
  return confirm === password ? undefined : t.confirmPassword.mismatch;
}

/** Bỏ khoá `undefined` để `toEqual({})` và `Object.keys(...).length` đúng nghĩa. */
function compact<K extends string>(
  errors: Record<K, string | undefined>,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of Object.keys(errors) as K[]) {
    const value = errors[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export type LoginField = 'email' | 'password';
export type LoginErrors = Partial<Record<LoginField, string>>;

/** Login: chỉ bắt TRỐNG + email sai định dạng. Cố ý không soi độ dài mật
 *  khẩu — sai/đúng do server quyết (401 → `invalidCredentials`). */
export function validateLogin(fields: { email: string; password: string }): LoginErrors {
  return compact({
    email: emailError(fields.email),
    password: requiredOnly(fields.password, t.password.required),
  });
}

export type RegisterField = 'name' | 'email' | 'password';
export type RegisterErrors = Partial<Record<RegisterField, string>>;

/** Register: name theo ngưỡng enquiry (≥2, ≤120 — cùng `CreateEnquiryInputSchema`),
 *  email chuẩn, password 8–128. */
export function validateRegister(fields: {
  name: string;
  email: string;
  password: string;
}): RegisterErrors {
  const name = fields.name.trim();
  let nameError: string | undefined;
  if (name.length === 0) nameError = t.name.required;
  else if (!CreateEnquiryInputSchema.shape.name.safeParse(name).success) {
    nameError = name.length < 2 ? t.name.tooShort : t.name.tooLong;
  }
  return compact({
    name: nameError,
    email: emailError(fields.email),
    password: newPasswordError(fields.password, t.password),
  });
}

export function validateForgotPassword(email: string): string | undefined {
  return emailError(email);
}

export type ResetPasswordField = 'password' | 'confirm';
export type ResetPasswordErrors = Partial<Record<ResetPasswordField, string>>;

export function validateResetPassword(fields: {
  password: string;
  confirm: string;
}): ResetPasswordErrors {
  return compact({
    password: newPasswordError(fields.password, t.newPassword),
    confirm: confirmError(fields.password, fields.confirm),
  });
}

export type ChangePasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
export type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;

export function validateChangePassword(fields: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): ChangePasswordErrors {
  return compact({
    currentPassword: requiredOnly(fields.currentPassword, t.currentPassword.required),
    newPassword: newPasswordError(fields.newPassword, t.newPassword),
    confirmPassword: confirmError(fields.newPassword, fields.confirmPassword),
  });
}

export const OTP_LENGTH = 6;

/** OTP: `InputOTP` đã chặn ký tự lạ và trần 6, nên chỉ còn "trống" và "chưa đủ". */
export function validateOtp(otp: string): string | undefined {
  if (otp.length === 0) return t.otp.required;
  return otp.length < OTP_LENGTH ? t.otp.incomplete : undefined;
}

/** Tên hồ sơ: ≥1 (Better Auth không ép min, nhưng tên trống là vô nghĩa), ≤120
 *  theo `contactName` của booking — cùng trần với tên liên hệ khi đặt chỗ. */
export function validateProfileName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return t.name.required;
  return CreateBookingInputSchema.shape.contactName.safeParse(trimmed).success
    ? undefined
    : t.name.tooLong;
}

/** Phone hồ sơ optional — trống thì thôi, có thì 6–30 ký tự (cùng rule
 *  `contactPhone` của booking, để số lưu ở hồ sơ dùng lại được khi đặt chỗ). */
export function validateProfilePhone(phone: string): string | undefined {
  const trimmed = phone.trim();
  if (trimmed.length === 0) return undefined;
  return CreateBookingInputSchema.shape.contactPhone.safeParse(trimmed).success
    ? undefined
    : t.phone.invalid;
}
