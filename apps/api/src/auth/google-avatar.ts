/**
 * Host ảnh hồ sơ Google mà Better Auth ghi vào `user.image` (claim `picture`
 * của ID token). Khớp `img-src` của CSP web và admin (ADR-0038 §a) — nới host
 * ở đây thì phải nới CSP cùng lượt.
 */
const GOOGLE_PROFILE_IMAGE_HOST = 'lh3.googleusercontent.com';

/**
 * Hai route Better Auth tạo user từ hồ sơ Google: nhánh ID token của app
 * mobile (`/sign-in/social`, ADR-0056) và callback OAuth của web. `ctx.path`
 * của Better Auth là mẫu route nên callback mang dạng `/callback/:id`.
 */
const GOOGLE_SIGN_IN_PATHS = new Set(['/sign-in/social', '/callback/:id']);

/** `https://lh3.googleusercontent.com/…` sau khi URL đã chuẩn hoá. */
export function isGoogleProfileImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === GOOGLE_PROFILE_IMAGE_HOST &&
    url.username === '' &&
    url.password === ''
  );
}

/**
 * Ảnh của user đang được TẠO qua đăng nhập Google. Guard avatar chung chỉ
 * nhận ảnh Cloudinary của mình (W2 mục 4), nên thiếu nhánh này thì mọi tài
 * khoản mới tạo bằng Google bị từ chối vì Better Auth ghi ảnh Google lúc tạo.
 *
 * - Path không phải đăng nhập Google → `undefined`: guard chung xử như cũ.
 * - Ảnh đúng host Google → giữ. Ảnh lấy từ token Google đã kiểm chữ ký, không
 *   phải chuỗi khách tự gõ.
 * - Ảnh lạ → `null` (bỏ ảnh) thay vì từ chối: đăng nhập không được hỏng chỉ
 *   vì Google đổi host ảnh; khách tự tải ảnh lên sau được.
 */
export function googleSignInAvatar(
  image: unknown,
  path: string | undefined,
): { image: string | null } | undefined {
  if (path === undefined || !GOOGLE_SIGN_IN_PATHS.has(path)) return undefined;
  return { image: typeof image === 'string' && isGoogleProfileImageUrl(image) ? image : null };
}
