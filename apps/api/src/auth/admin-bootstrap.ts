/**
 * Bootstrap admin dual-grant (spec §5, kế thừa tinh thần Nexora):
 * env ADMIN_EMAILS liệt kê các email được promote lên ADMIN ngay khi tạo user
 * (databaseHooks.user.create.after). Chỉ promote — KHÔNG BAO GIỜ demote:
 * gỡ email khỏi ADMIN_EMAILS không hạ role đã cấp.
 */

/** So khớp email với danh sách bootstrap admin — case-insensitive, trim. */
export function isBootstrapAdmin(email: string, admins: readonly string[]): boolean {
  const needle = email.trim().toLowerCase();
  if (needle.length === 0) return false;
  return admins.some((a) => a.trim().toLowerCase() === needle);
}
