/**
 * Tên cookie phiên của Better Auth — dev http tên trần, prod https có prefix `__Secure-` (bài học I-1
 * của web: thiếu tên thứ hai là user prod bị đá về /login dù đã đăng nhập). MỘT nơi khai cho proxy và
 * trang login: hai danh sách chép tay là hai chỗ phải nhớ sửa cùng lúc.
 */
export const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;
