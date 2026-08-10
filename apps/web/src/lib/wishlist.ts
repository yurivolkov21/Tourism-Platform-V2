/**
 * Logic thuần cho nút tim wishlist (cụm B, nửa 1).
 *
 * Tách khỏi component để test được mà không cần dựng DOM: hai hàm ở đây quyết
 * định (a) khách chưa đăng nhập bị đưa đi đâu và (b) trạng thái tim đổi ra sao.
 */

/**
 * Đường tới trang đăng nhập, mang theo chỗ đang đứng để quay lại.
 *
 * Giữ NGUYÊN cả query: khách đang lọc "Huế, sắp theo giá" mà đăng nhập xong bị
 * ném về `/tours` trống là mất công họ vừa chọn.
 *
 * Chặn open redirect ngay tại đây dù trang login đã có `safeRedirect`: đó là
 * lớp thứ hai, còn lớp này khiến chính URL khách nhìn thấy trên thanh địa chỉ
 * cũng đã sạch. Chỉ nhận đường dẫn nội bộ bắt đầu bằng đúng MỘT dấu `/` —
 * `//evil.test` là URL giao thức-tương-đối, trình duyệt hiểu là host ngoài.
 */
export function signInHref(pathname: string, search: string): string {
  const safePath = /^\/(?!\/)/.test(pathname) ? pathname : '/';
  const query = search.startsWith('?') ? search.slice(1) : search;
  const target = query ? `${safePath}?${query}` : safePath;
  return `/login?redirect=${encodeURIComponent(target)}`;
}

/**
 * Bật/tắt một tour trong tập đã lưu.
 *
 * Trả Set MỚI chứ không sửa tại chỗ — React so sánh bằng tham chiếu, sửa tại
 * chỗ thì component không render lại và tim không đổi màu.
 */
export function toggleWished(current: ReadonlySet<string>, tourId: string): Set<string> {
  const next = new Set(current);
  if (next.has(tourId)) next.delete(tourId);
  else next.add(tourId);
  return next;
}
