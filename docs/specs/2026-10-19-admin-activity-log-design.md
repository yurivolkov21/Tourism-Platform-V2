# Spec — Nhật ký thao tác admin và trang Activity

- **Ngày:** 2026-10-19 · **Trạng thái:** Yuri chọn làm 19/10 08:36 UTC (mục 8 của bản rà "Việc còn
  thiếu ở api, web, admin"), chọn "Chỉ Owner" 08:49 UTC. Phạm vi đã gửi Yuri ở thư mục chung của
  project (`admin-audit/pham-vi-nhat-ky-thao-tac.md`); spec này là bản chi tiết của nó.
- **Quyết định kiến trúc:** [ADR-0061](../adr/0061-admin-activity-log.md).
- **Nền:** [spec P4f Users](2026-10-02-p4f-users-staff-design.md) (Owner và Staff, `user_events`) ·
  [spec G43](2026-10-13-g43-subscribers-selection-dates.md) (khoảng ngày theo `createdAtRange`).

## 1. Vấn đề

Owner không trả lời được "ai đã làm việc này, lúc nào": vết thao tác admin chỉ có trong log Render,
giữ khoảng một tuần. Từ khi có Staff (13/10), có hơn một người sửa catalog, hoàn tiền, khoá tài khoản.

## 2. Phạm vi

- **Có:** mọi lệnh ghi của admin khi thành công (37 thủ tục, §3) và ba lượt xuất Excel; trang
  `/activity` chỉ Owner xem, mới nhất trước, lọc theo người làm, khu vực, khoảng ngày, link tới đối
  tượng nếu nó còn.
- **Không:** lệnh chỉ đọc, lệnh thất bại, lệnh ký tải ảnh lên; nội dung đã sửa (không lưu bản trước
  và sau); email, số điện thoại, dữ liệu thanh toán của khách; sửa hay xoá dòng nhật ký; xem lại thao
  tác trước ngày bật; xuất nhật ký ra file.

## 3. Bảng thao tác

Khoá thao tác là khoá thủ tục; khu vực là phần trước dấu chấm. "Nhãn" là chữ chụp lúc ghi. "Chi tiết"
là các giá trị lưu ở `details`. Lệnh xoá đọc nhãn trước khi chạy. Lệnh có cờ `changed: false` trong
output (không đổi gì) thì không ghi.

| Khoá | Đối tượng (id) | Nhãn | Chi tiết | Nhãn tiếng Anh của thao tác |
| --- | --- | --- | --- | --- |
| `bookings.refund` | đơn (mã đơn) | mã đơn | `amount`, `currency`, `full` | Refunded booking |
| `reviews.moderate` | review (id) | tên tour | `verdict` | Moderated review |
| `outbox.retry` | email (id) | trống | `emailType` | Retried email |
| `enquiries.setStatus` | enquiry (id) | tên người hỏi | `status` | Changed enquiry status |
| `enquiries.addNote` | enquiry (id) | tên người hỏi | trống | Added enquiry note |
| `subscribers.unsubscribe` | người nhận tin (id) | trống | trống | Unsubscribed a subscriber |
| `tours.create` | tour (id) | tên tour | trống | Created tour |
| `tours.updateDetails` | tour (id) | tên tour | trống | Edited tour details |
| `tours.setItinerary` | tour (id) | tên tour | `days` | Edited itinerary |
| `tours.setFaqsPolicies` | tour (id) | tên tour | `faqs`, `policies` | Edited FAQs and policies |
| `tours.setCosts` | tour (id) | tên tour | `items` | Edited costs |
| `tours.setPhotos` | tour (id) | tên tour | `photos` | Edited tour photos |
| `tours.setPublished` | tour (id) | tên tour | `published` | Put on sale / Took off sale |
| `tours.delete` | tour (id) | tên tour | trống | Deleted tour |
| `categories.create` | danh mục (id) | tên | trống | Created category |
| `categories.update` | danh mục (id) | tên | trống | Edited category |
| `categories.setActive` | danh mục (id) | tên | `active` | Showed / Hid category |
| `categories.move` | danh mục (id) | tên | `direction` | Moved category |
| `categories.delete` | danh mục (id) | tên | trống | Deleted category |
| `destinations.create` | điểm đến (id) | tên | trống | Created destination |
| `destinations.update` | điểm đến (id) | tên | trống | Edited destination |
| `destinations.setActive` | điểm đến (id) | tên | `active` | Showed / Hid destination |
| `destinations.setPhotos` | điểm đến (id) | tên | `photos` | Edited destination photos |
| `destinations.delete` | điểm đến (id) | tên | trống | Deleted destination |
| `departures.create` | chuyến (id) | tên tour | `startDate` | Added departure |
| `departures.update` | chuyến (id) | tên tour | `startDate` | Edited departure |
| `departures.setStatus` | chuyến (id) | tên tour | `startDate`, `status` | Opened / Closed departure |
| `departures.cancel` | chuyến (id) | tên tour | `startDate` | Cancelled departure |
| `posts.create` | bài viết (id) | tiêu đề | trống | Created post |
| `posts.update` | bài viết (id) | tiêu đề | `status` | Edited post |
| `posts.delete` | bài viết (id) | tiêu đề | trống | Deleted post |
| `appearance.setSlot` | khe ảnh (khoá khe) | khoá khe | trống | Replaced site image |
| `media.update` | ảnh (publicId) | nhãn chỗ dùng đầu tiên | `uses` | Edited photo details |
| `users.setRole` | tài khoản (id) | tên hiển thị | `role` | Granted / Removed Staff access |
| `users.lock` | tài khoản (id) | tên hiển thị | trống | Locked account |
| `users.unlock` | tài khoản (id) | tên hiển thị | trống | Unlocked account |
| `users.revokeSessions` | tài khoản (id) | tên hiển thị | `sessions` | Signed out everywhere |
| `bookings.export` | trống | trống | `rows`, `mode`, `filtered` | Exported bookings |
| `subscribers.export` | trống | trống | `rows`, `mode`, `filtered` | Exported subscribers |
| `reports.export` | trống | trống | `month` | Exported monthly report |

Ghi chú:

- Người hỏi của enquiry: tên là thứ trang Enquiries hiện làm nhãn chính; email và số điện thoại
  không bao giờ vào nhật ký. Người nhận tin chỉ có email nên không có nhãn ("a subscriber").
- Tài khoản: tên hiển thị, trống thì không có nhãn ("an account"); không lấy email.
- `outbox.retry`: người nhận là email của khách nên không lưu; chỉ loại email.
- Lý do khoá tài khoản, lý do huỷ chuyến, nội dung ghi chú enquiry và lý do hoàn tiền là chữ admin
  gõ: không chép. Lý do khoá vẫn ở `user_events`, lý do huỷ ở chính dòng chuyến, lý do hoàn ở
  `refunds`.
- `full` của hoàn tiền: đơn đã hoàn hết sau lệnh này.

## 4. Dòng nhật ký

`when` · người làm (`actorId`, nhãn, bậc lúc ấy) · `action` · `area` · đối tượng (`type`, `id`,
`label`) · `details`. Nhãn người làm là tên, trống thì email của chính admin ấy (đây là người trong
nhóm, Owner đã thấy ở trang Users).

## 5. Contract

- `ADMIN_ACTIVITY` (`log` hoặc `skip`) cho mọi khoá của `ADMIN_ACCESS`; danh sách khoá thao tác là
  37 khoá `log` cộng ba khoá xuất. Hàm thuần `activityArea(action)`.
- `admin.activity.list` (owner): input `page`, `limit` (mặc định 20, tối đa 100, như mọi bảng admin), `actorId`, `area`,
  `from`, `to` (`CalendarDateSchema`, khoảng ngược là 400, cùng luật `createdAtRange` với
  `/subscribers`: URL trần là mọi ngày). Output `items`, `total`, `page`, `limit`, và `actors`
  (người làm có trong nhật ký, cho ô lọc). Mỗi item có `target.ref`: khoá đường hiện tại của đối
  tượng nếu nó còn (slug tour, slug bài viết, slug điểm đến, slug tour của chuyến, mã đơn, id enquiry,
  id tài khoản, khoá khe), không thì `null`.
- `admin.activity.recordExport` (staff): input `kind` (`bookings`, `subscribers`, `reports`), `rows`,
  `mode` (`all` hoặc `selection`), `filtered` (có lọc hay không), `month` (chỉ `reports`).

## 6. Trang `/activity`

- Sidebar nhóm System, mục **Activity**, chỉ Owner thấy (`access: 'activity.list'`); Staff mở thẳng
  URL nhận trang Not authorized như `/users`.
- Thanh lọc: People (All people và từng người làm), Area (All areas và 14 khu vực), khoảng ngày From
  và To. Lọc giữ trên URL, đổi lọc về trang 1.
- Bảng: When (ngày giờ UTC như các bảng khác), Who (nhãn và huy hiệu Owner hay Staff), What (nhãn
  thao tác và một câu tóm tắt từ `details`, ví dụ "Refunded $120.00 (full)"), Item (nhãn, là link khi
  `ref` còn; trống thì chữ thay thế như "a subscriber").
- Link: đơn `/bookings/<mã>`, enquiry `/enquiries/<id>`, tour `/tours/<slug>`, chuyến
  `/tours/<slug>/departures`, bài viết `/posts/<slug>`, điểm đến `/destinations/<slug>/photos`, tài
  khoản `/users/<id>`, khe ảnh `/appearance#<khoá>`. Review, email, danh mục, ảnh và người nhận tin
  không có trang riêng: chỉ có nhãn.
- Trống: "No activity yet" khi chưa có dòng nào; "No activity matches these filters" khi có lọc.
- Phân trang như các bảng khác.

## 7. Xuất Excel

Ba route xuất gọi `recordExport` một lần, sau khi file đã dựng xong và ngay trước khi trả file. Lỗi
khi gọi không chặn file: route log một dòng như `logExportAudit` hiện có. Lượt xuất lỗi, quá lớn hay
dữ liệu đổi giữa chừng không ghi.

## 8. Kiểm thử

- Contract: phân loại đủ (typecheck), schema list và recordExport, `activityArea`.
- API int: mỗi nhóm thao tác ghi đúng một dòng với nhãn và chi tiết đúng; lệnh lỗi (404, 409) không
  ghi; `changed: false` không ghi; lỗi khi ghi nhật ký không làm hỏng response; lệnh xoá có nhãn;
  list lọc theo người, khu vực, ngày; `ref` null khi đối tượng đã xoá; Staff gọi list nhận 403, gọi
  recordExport được; khách 403, chưa đăng nhập 401.
- Admin: hàm dựng link và câu tóm tắt; trang Owner thấy, Staff không thấy mục sidebar; đo Chromium ở
  1440, 768 và 390 không cuộn ngang trang.

### 8.1 Thử tay trên production sau merge

1. Owner sửa một tour (gỡ bán rồi bán lại), mở `/activity`: hai dòng mới nhất là "Took off sale" và
   "Put on sale" với tên tour, link mở đúng tour.
2. Xuất Excel ở `/bookings`: dòng "Exported bookings" với số dòng khớp file.
3. Đăng nhập Staff: không thấy mục Activity; mở `/activity` thì nhận Not authorized.

## 9. Deploy

Một migration tạo bảng `admin_activity` (Yuri chạy tay trên Supabase trước khi đẩy main, như G25).
Không biến env, không dependency mới. Push main thì Render dựng API, Vercel dựng admin; web không đổi.

## 10. Đối chiếu Nexora (luật 10)

Nexora không có nhật ký thao tác admin: phần v2 thêm. Hạ tầng xuyên suốt: quyền theo `ADMIN_ACCESS`,
trần ghi tự áp cho `recordExport` (ADR-0037), lỗi ghi nhật ký đi Sentry seam (ADR-0010), không thêm
client Postgres (ADR-0024 AMEND 4).
