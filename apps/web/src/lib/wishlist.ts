/**
 * Logic thuần cho wishlist: nút tim (cụm B, nửa 1) và thẻ đã lưu ở `/account/saved`.
 *
 * Tách khỏi component để test được mà không cần dựng DOM: các hàm ở đây quyết định (a) khách
 * chưa đăng nhập bị đưa đi đâu, (b) trạng thái tim đổi ra sao và (c) ngày lưu in thế nào.
 */
import { vietnamToday } from '@tourism/contract';
import { formatChipDate, formatDate } from './tours';

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

/**
 * Ngày lưu trên thẻ `/account/saved` (spec 09/10 §3): "3 Oct"; khác năm với hôm nay thì
 * "3 Oct 2025".
 *
 * `addedAt` là mốc giờ ISO (`…Z`), nên đổi sang NGÀY LỊCH VIỆT NAM trước (`vietnamToday`) rồi
 * mới in — lưu lúc 01:30 sáng giờ Việt Nam là ngày hôm ấy, dù theo UTC vẫn là hôm trước; năm
 * cũng so theo chính ngày ấy.
 *
 * `today` là ngày lịch Việt Nam do trang server tính (`todayDateString`), KHÔNG đọc đồng hồ ở
 * đây: thẻ là Client Component, đọc đồng hồ thì HTML của server và lần hydrate có thể in khác
 * nhau ngay đêm giao thừa, và máy khách để sai giờ là in sai năm.
 */
export function formatSavedDate(addedAt: string, today: string): string {
  const day = vietnamToday(new Date(addedAt));
  return day.slice(0, 4) === today.slice(0, 4) ? formatChipDate(day) : formatDate(day);
}
