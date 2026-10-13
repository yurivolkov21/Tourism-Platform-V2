# Spec G43 — Chọn hàng và lọc ngày ở `/subscribers`

- **Ngày:** 2026-10-13 · **Trạng thái:** user cho làm 13/10 (thread "Admin: việc còn tồn đọng");
  spec ngắn theo mục G43 của [open-items](../open-items.md), thi công trên nhánh
  `fix/admin-open-items`.
- **Nền:** [spec P4c](2026-09-02-p4c-operations-design.md) §3-F10 (trang `/subscribers`) ·
  [spec P4b](2026-08-31-p4b-admin-ready-areas-design.md) §3-F6 (khoảng ngày của `/bookings`) ·
  [spec chọn hàng của `/bookings`](2026-09-01-bookings-export-selection-design.md) (01/09) ·
  [ADR-0028](../adr/0028-bookings-stats-follow-filter.md) AMEND 2 (khoảng ngày của `/reviews`) ·
  [ADR-0034](../adr/0034-excel-report-export.md) AMEND 3 (file Excel)
- **Đóng:** G43.

## 1. Vấn đề

Nút Export của `/subscribers` luôn xuất cả tập theo tab, nguồn và từ khoá, thường gần như cả
danh sách. Không có cách xuất vài địa chỉ đã chọn, cũng không có cách xuất những người đăng ký
trong một khoảng ngày. User để ý ở bước 4 lượt thử tay production G40 Phần 3 (12/10).

## 2. Quyết định

1. **Khoảng ngày tuỳ chọn, không có mặc định.** `from` và `to` là ngày lịch `YYYY-MM-DD` theo
   cột `createdAt` (cột "Subscribed at"). Hai đầu đều tính vào. API đổi ra biên nửa-mở bằng
   `createdAtRange`, hàm dùng chung với `/bookings` và `/reviews`, nên ngày ở đây cũng là ngày
   UTC như hai bảng kia. URL trần nghĩa là mọi ngày, giống `/reviews` và khác `/bookings`. Đây
   là danh sách liên lạc chứ không phải sổ giao dịch: tự lọc một tháng sẽ giấu phần lớn danh
   sách và đổi luôn thứ nút Export xuất ra khi không ai đụng gì. Vì URL trần đã là mọi ngày nên
   không cần `?dates=all`.
2. **Contract.** `admin.subscribers.list` nhận thêm `from` và `to` (`CalendarDateSchema`).
   Khoảng ngược trả 400, cùng luật `refine` với hai bảng kia. Không có migration: bảng nhỏ, và
   ngưỡng xem lại index vẫn là khoảng 10 nghìn hàng như ghi chú của `createdAtRange`.
3. **Chọn hàng theo khuôn `/bookings`.** Bảng có cột ô tích ở đầu. Ô ở hàng tiêu đề chọn cả
   trang đang xem, và nhãn nói đúng là "on this page". Tích bị xoá mỗi khi bộ lọc, trang hay số
   dòng mỗi trang đổi. Có hàng được tích thì nút đổi thành "Export N rows" và href mang thêm
   `page`, `limit` và `sel`. `sel` là danh sách `id` cách nhau bằng dấu phẩy, nhiều nhất 100 vì
   `limit` nhiều nhất 100. URL mang `id` chứ không mang email, vì email là dữ liệu cá nhân.
4. **Route xuất khi có `sel`.** Route lấy đúng một trang theo cùng bộ lọc, với
   `includeSources: false` và cùng ngân sách thời gian như nhánh xuất cả tập. Sau đó nó giữ các
   hàng có `id` nằm trong `sel`. Thiếu bất kỳ hàng nào thì trả 409 với câu `exportSelectionStale`
   dùng chung, không giao file thiếu hàng. Vết audit ghi `mode: 'selection'`. Không tích gì thì
   đường cũ giữ nguyên: cả tập, trần `EXPORT_MAX_ROWS`, 413 và 409 như trước.
5. **File Excel.** Đầu trang thêm khoảng ngày, kèm chữ "(UTC)" như file bookings vì cột mốc
   thời gian trong file ghi giờ Việt Nam. Khi xuất có chọn, đầu trang thêm "n selected rows".
6. **Màn hình.** Ô ngày dùng kit `ToolbarDateRange` với nhãn "Filter by subscribed date". Nút
   Clear filters xoá cả hai ô ngày. Bảng rỗng trong lúc lọc ngày thì nói rõ khoảng ngày và có
   nút "Show subscribers from all dates", như `/reviews`. Câu 413 nhắc thêm cách thu hẹp bằng
   khoảng ngày.

## 3. Ngoài phạm vi

- Chọn hàng xuyên trang, hay chọn cả tập đang lọc.
- Hành vi hàng loạt khác, ví dụ gỡ nhiều địa chỉ một lúc.
- Lọc theo ngày xác nhận hay ngày huỷ.
- Hàng stat card trên đầu trang: giữ nguyên.

## 4. Kiểm

- Contract: `from` và `to` nhận ngày lịch, từ chối khoảng ngược và ngày sai định dạng.
- Int test API: lọc đúng biên nửa-mở. Hàng tạo lúc 23:59:59.999 UTC của ngày `to` có mặt,
  hàng tạo lúc 00:00 UTC ngày kế tiếp thì không.
- Admin: hàm parse và hàm dựng href, href xuất (có `sel` thì kèm `page` và `limit`, mảng rỗng là
  không chọn), bảng (ô tích, nhãn nút, xoá tích khi query đổi), route xuất (đủ hàng thì ra file,
  thiếu hàng thì 409, audit ghi đúng chế độ), đầu trang của file Excel.
- `pnpm gate:int` xanh. Soi bố cục hàng điều khiển ở 390px, 768px và 1600px bằng CSS build thật,
  vì hàng này thêm hai ô ngày.

## 5. Ghi chú thi công (13/10)

- **Thứ tự đầu trang file Excel khác file bookings.** Đầu trang là tab, khoảng ngày, số hàng chọn,
  nguồn rồi từ khoá. Số hàng chọn đứng trước nguồn và từ khoá vì hai phần ấy là chữ tự do (tới 40
  và 120 ký tự) còn chữ của tab Active đã dài 32 ký tự. Đứng sau chúng thì "n selected rows" là
  phần đầu tiên bị cắt khi đầu trang chạm trần 100 ký tự, và tờ in sẽ nói đó là cả tập.
- **Phần chung của cú xuất có chọn lên kit.** `lib/export-selection.ts` giữ tên tham số `sel`, hàm
  đọc nó từ URL và luật "thiếu một hàng là 409". `/bookings/export` chuyển sang dùng chung, hành vi
  không đổi.
- **Ô tích một phần vẽ dấu gạch.** Lúc soi bằng CSS build thật, ô tiêu đề khi mới tích vài hàng
  hiện dấu tích không nền, nhìn như đã chọn hết. `Checkbox` dùng chung nay đổ nền và vẽ dấu gạch ở
  trạng thái này. `/bookings` (có ô tích từ 01/09) cũng được sửa theo.
- **Số đo bố cục.** Trang không tràn ngang ở 390, 768, 1024 và 1600px. Hàng điều khiển xuống dòng
  gọn: một hàng ở 1600px khi chưa lọc, tới bốn hàng ở 390px khi lọc đủ, không ô nào lòi khỏi mép.
  Cột email giữ 288px ở mọi khổ. Bảng có email dài rộng 1100px và cuộn ngang trong khung, nên dưới
  khoảng 1400px nút Export ở ô tiêu đề cột Actions nằm ngoài khung nhìn. Chuyện này có từ khi nút
  dời vào ô tiêu đề ([spec 2026-10-05](2026-10-05-admin-ui-polish-design.md) §4 #4); cột ô tích chỉ
  thêm 24px.
