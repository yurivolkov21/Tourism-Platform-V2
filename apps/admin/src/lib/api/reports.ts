import type { AdminMonthlyReport } from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Báo cáo tháng (spec P4b §3-F6) — bọc mỏng `admin.reports.monthly`.
 *
 * KHÁC ba fetcher `stats.*`: ở đây KHÔNG cache. Stats được cache 60s vì hàng
 * card bị refetch trên mọi click phân trang/lọc và nằm trên đường
 * `useTransition` khoá nút ghi — không có điều nào đúng với trang này (nó
 * không phân trang, không có hành vi ghi). Đổi lại, đây là con số admin ĐEM
 * IN RA GIẤY: 60 giây "gần đúng" cho một tờ báo cáo là cái giá không đáng
 * trả, trong khi mỗi lần mở trang chỉ tốn đúng một request.
 *
 * KHÔNG nuốt lỗi: contract không khai mã nghiệp vụ nào (tháng trống là báo
 * cáo toàn số 0), nên mọi lỗi ở đây là lỗi thật và phải rơi vào
 * `app/error.tsx` như mọi đường đọc khác.
 */
export async function fetchAdminMonthlyReport(
  cookie: string,
  month: string,
): Promise<AdminMonthlyReport> {
  return api.admin.reports.monthly({ month }, { context: withAdminAuth(cookie) });
}
