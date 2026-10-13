# Spec G45 — Lọc `/bookings` theo một tài khoản

- **Ngày:** 2026-10-13 · **Trạng thái:** user chọn "Làm luôn" trên thẻ quyết định 13/10 (thread
  "Admin: việc còn tồn đọng"); spec ngắn theo mục G45 của [open-items](../open-items.md), thi công
  trên nhánh `fix/admin-open-items-2`.
- **Nền:** [spec P4f](2026-10-02-p4f-users-staff-design.md) §7.2 và §11 (link "View bookings") ·
  [spec P4b](2026-08-31-p4b-admin-ready-areas-design.md) §2.2 (trạng thái bảng sống trên URL) và
  §3-F6 (khoảng ngày, file xuất) · [spec chọn hàng của `/bookings`](2026-09-01-bookings-export-selection-design.md)
- **Đóng:** G45.

## 1. Vấn đề

Link "View bookings" ở `/users/[id]` mở `/bookings?q=<email>&dates=all`. Ô tìm của
`admin.bookings.list` khớp `contains` trên mã đơn, email liên hệ và tên liên hệ, nên tài khoản
`an@example.com` thấy lẫn booking của `lan@example.com` và `joan@example.com`. Chiều ngược lại cũng
sai: khách đặt bằng một email liên hệ khác thì booking ấy không hiện. Số hàng vì thế lệch con số
"Bookings" trên card của trang tài khoản, vốn đếm theo `userId`.

## 2. Quyết định

1. **Contract.** `admin.bookings.list` nhận thêm `userId` (`z.uuid()`, tuỳ chọn). Bộ lọc này CỘNG
   DỒN với `status`, `search` và khoảng ngày như ba bộ lọc kia. `userId` không ứng với ai thì trả
   trang rỗng (200), không phải 404: đây là một bộ lọc, không phải tra một tài khoản. `userId` sai
   định dạng là 400 như mọi input rác khác. Không migration: bảng `bookings` đã có index
   `(user_id, created_at)` từ migration init.
2. **URL.** Tham số `user=<id>`. Hàm parse dùng cùng `z.uuid()`; giá trị rác bị bỏ như `status`
   ngoài enum, cùng luật khoan dung của bảng (URL là thứ người gõ được). Tham số đi theo mọi href của
   bảng (đổi tab, tìm, đổi ngày, phân trang, cỡ trang), theo link sang trang chi tiết và nút Back
   về danh sách, và theo link xuất file.
3. **Link "View bookings"** đổi thành `/bookings?user=<id>&dates=all`. `dates=all` giữ lý do cũ
   (P4f, quyết định 7): URL trần của bảng tự lọc tháng hiện tại. Link vẫn chỉ hiện khi tài khoản có
   booking.
4. **Chip trên hàng điều khiển.** Có `user` thì hàng điều khiển hiện một chip "Account:
   <email>" kèm nút gỡ. Nút gỡ là link chỉ bỏ `user`, giữ mọi bộ lọc khác. Email lấy từ
   `admin.users.byId`, thủ tục chỉ Owner gọi được, nên trang chỉ hỏi khi phiên là Owner. Staff
   chỉ tới được URL này khi có người dán cho họ; lúc đó, hay khi tài khoản không còn, chip ghi
   "One account" chứ không đoán. Trang không gọi thủ tục mà phiên không có quyền.
5. **Clear filters** gỡ cả `user`. Đang lọc theo tài khoản thì nhãn nút là "Clear filters", không
   phải "Show bookings from all dates".
6. **File xuất.** Route `/bookings/export` đọc `user` qua cùng hàm parse nên file khớp bảng. Đầu
   trang file thêm "account <email>" (cắt ở 40 ký tự như từ khoá; chữ thường như mẩu
   `search “…”` đứng cạnh), hoặc "one account" khi không đọc được email. Vết audit ghi `user: '<set>'` như `search`, không ghi id hay email.
7. **Hàng stat card** giữ nguyên: nó chỉ theo khoảng ngày, như với `status` và `search` hiện nay.

## 3. Ngoài phạm vi

- Chọn tài khoản ngay trên `/bookings` (ô tìm tài khoản, menu chọn).
- Lọc theo tài khoản ở `/reviews` hay `/enquiries`.
- Hàng stat card theo tài khoản.

## 4. Kiểm

- Contract: `userId` nhận uuid, từ chối chuỗi không phải uuid.
- Int test API: hai tài khoản `an@…` và `lan@…` mỗi người một booking; lọc theo `userId` của `an`
  chỉ ra booking của `an`, kể cả khi booking của `lan` có email liên hệ chứa `an@`. Cộng dồn với
  `status` và khoảng ngày. `userId` không ứng với ai cho trang rỗng; `userId` rác là 400.
- Admin: parse và mọi href (giữ `user` khi đổi bộ lọc khác, `userId: null` gỡ nó, Clear filters
  gỡ nó, link chi tiết và nút Back mang nó, link xuất mang nó), link "View bookings", chip (nhãn có
  email, nhãn chung, href của nút gỡ), hàm lấy nhãn chỉ gọi `users.byId` khi phiên là Owner, đầu
  trang file Excel, route xuất truyền `userId` xuống API.
- `pnpm gate:int` xanh. Soi hàng điều khiển ở 390px, 768px và 1600px bằng CSS build thật, vì hàng
  này thêm một chip.
