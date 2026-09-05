import type * as React from 'react';

/**
 * KHUNG chung của mọi bảng admin — bê nguyên cấu trúc + class của block
 * `dashboard-01` (bản demo `components/data-table.tsx` đã xoá ở P4d, ADR-0036
 * §3 — file này nay là NGUỒN DUY NHẤT của khung ấy): một hàng điều khiển trên
 * cùng (chọn view bên trái · hành động bên phải), thân bảng bọc viền bo góc,
 * thanh phân trang dưới cùng.
 *
 * Vì sao tách ra kit thay vì mỗi vùng tự dựng lại (user chốt 31/08 — "các
 * bảng phải đồng bộ, thống nhất một kiểu thiết kế"): copy-paste ba lần cho
 * bookings/cancellations/reviews là ba cơ hội để chúng trôi mỗi nơi một kiểu.
 * Ở đây khoảng cách (`gap-6` ngoài, `gap-4` trong) và padding (`px-4 lg:px-6`)
 * có ĐÚNG MỘT nguồn; vùng chỉ điền nội dung vào bốn khe.
 *
 * Trang `/` từ P4d cũng lắp bảng "Recent bookings" vào chính khung này
 * (`recent-bookings-table.tsx`) — footer của nó là một link thay vì thanh
 * phân trang, khe `footer` nhận `ReactNode` nên không phải nới gì.
 */
export interface DataTableFrameProps {
  /** Khe trái hàng điều khiển: tab lọc (desktop) + select tương đương (mobile). */
  views: React.ReactNode;
  /** Khe phải hàng điều khiển: ô tìm kiếm, menu ẩn/hiện cột… */
  actions: React.ReactNode;
  /** Thân bảng — component tự render `<Table>`, khung chỉ lo viền/bo góc. */
  children: React.ReactNode;
  /** Thanh phân trang (dùng `TablePagination` của kit). */
  footer: React.ReactNode;
}

export function DataTableFrame({ views, actions, children, footer }: DataTableFrameProps) {
  return (
    <div className="flex w-full flex-col justify-start gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        {views}
        {/* `flex-wrap` từ F6: khe hành động của `/bookings` nay mang thêm hai
            ô ngày và nút export, đủ để tràn ở màn hẹp — xuống dòng còn hơn
            đẩy ngang cả hàng điều khiển ra khỏi khung. */}
        <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">{children}</div>
        {footer}
      </div>
    </div>
  );
}
