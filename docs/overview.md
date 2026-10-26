# Tổng quan — sản phẩm này là gì

> Viết cho người đọc lần đầu, **không cần biết lập trình**. Từ nào lạ thì tra
> [thuật ngữ](glossary.md). Muốn biết vì sao chọn cách làm nào thì đọc tiếp
> [bản đồ tài liệu](README.md).

## Một đoạn

Đây là **website bán tour du lịch**, làm bài tốt nghiệp. Khách vào xem danh sách
tour, chọn ngày khởi hành còn chỗ, điền thông tin liên hệ, trả tiền bằng thẻ, rồi
nhận email xác nhận. Nếu đổi ý, khách tự bấm huỷ và được hoàn tiền theo một luật
công khai. Đi về, khách viết đánh giá. Phía trong, nhân viên có trang quản trị
riêng để xem đơn, xử lý hoàn tiền ngoại lệ, duyệt đánh giá và xuất báo cáo.

Khách cũng dùng được app Android để xem tour, đặt chỗ, theo dõi chuyến và viết
đánh giá. Trên web có thêm một trợ lý AI trả lời câu hỏi về tour.

Website chạy thật trên Internet tại [www.nexora-travel.agency](https://www.nexora-travel.agency), nhưng **không ai
mất tiền thật**: cổng thanh toán Stripe và PayPal luôn ở chế độ thử nghiệm — thẻ
dùng để thử là thẻ giả do chính Stripe/PayPal cấp.

## Ai dùng, và làm được gì

| Người dùng | Cần đăng nhập? | Làm được gì |
| --- | --- | --- |
| **Khách vãng lai** | Không | Xem tour, xem điểm đến, đọc blog, gửi câu hỏi, đăng ký nhận bản tin |
| **Khách có tài khoản** | Có | Tất cả những việc trên, cộng: đặt tour, trả tiền, xem chuyến của mình, tự huỷ, lưu tour yêu thích, viết và sửa đánh giá |
| **Nhân viên (Staff)** | Có, do chủ trang cấp quyền | Xem toàn bộ đơn và bảng số liệu, duyệt hoặc từ chối đánh giá, theo dõi câu hỏi khách gửi, tạo và sửa tour, lịch chuyến, bài viết, thay ảnh của trang web và quản lý thư viện ảnh |
| **Chủ trang (Owner)** | Có, email nằm trong danh sách cấu hình sẵn | Mọi việc của nhân viên, cộng: hoàn tiền ngoại lệ, huỷ chuyến, xoá tour, bài viết, danh mục và điểm đến, xem báo cáo tháng và sổ sự kiện thanh toán, cấp quyền nhân viên, khoá tài khoản, xem nhật ký thao tác |

Hệ thống có **ba mức quyền**: khách (`CUSTOMER`), nhân viên (`STAFF`) và chủ trang
(`ADMIN`). Chủ trang cấp hay thu quyền nhân viên cho một khách đã xác minh email,
và khoá được tài khoản: tài khoản bị khoá không đăng nhập được ở đâu cả.

## Bảy luồng chính

### 1. Tìm tour

Khách vào trang chủ hoặc trang danh sách tour, lọc theo điểm đến, chủ đề, giá,
độ khó. Mỗi tour có trang riêng gồm 5 tab: giới thiệu, lịch trình từng ngày,
các ngày khởi hành còn chỗ, đánh giá của khách trước, và phần cần-biết-trước.

Điểm cần nắm: một **tour** là sản phẩm được bày bán (ví dụ "Hạ Long 3 ngày 2
đêm"), còn một **chuyến** (departure) là một lần chạy cụ thể của tour đó vào
một khoảng ngày nhất định, có số chỗ riêng. Khách đặt **chuyến**, không đặt
tour chung chung.

### 2. Đặt chỗ và trả tiền

Khách chọn chuyến, khai số người lớn / trẻ em, điền thông tin liên hệ. Hệ thống
tạo một **đơn** (booking) ở trạng thái *chờ thanh toán*, giữ chỗ tạm, rồi chuyển
khách sang trang trả tiền của Stripe hoặc PayPal.

Ba điều quan trọng:

- **Giá do máy chủ tính, không do trình duyệt gửi lên.** Sửa giá trên trình
  duyệt không ăn thua.
- **Đơn chưa trả tiền sẽ tự hết hạn** và nhả chỗ lại cho người khác.
- **Không thu tiền hai lần.** Nếu cổng thanh toán vì lý do nào đó thu được hai
  lần, hệ thống tự phát hiện và hoàn lại ngay khoản thừa.

Trả tiền xong, đơn chuyển sang *đã thanh toán* và khách nhận email xác nhận kèm
mã đơn.

### 3. Huỷ và hoàn tiền

Mỗi chuyến có **một hạn chót duy nhất**, tính tự động theo độ dài chuyến: chuyến
1 ngày thì hạn là trước ngày đi 1 ngày, chuyến 2–3 ngày là 3 ngày, chuyến từ 4
ngày trở lên là 7 ngày. Hạn kết thúc lúc 23:59 giờ Việt Nam.

- **Trong hạn:** khách tự huỷ, được hoàn **toàn bộ**, xử lý ngay, không phải chờ
  ai duyệt.
- **Quá hạn:** không tự hoàn được nữa; chuyến cũng ngừng nhận đặt mới từ đúng
  lúc đó.
- **Ngoại lệ** (ốm đau, việc gấp): khách liên hệ, nhân viên quản trị hoàn tay,
  bắt buộc ghi số tiền và lý do vào sổ.
- **Công ty huỷ chuyến:** hoàn 100%, mọi lý do.

Nguyên tắc đằng sau: *chỗ còn bán lại được thì hoàn đủ; không bán lại được nữa
thì không tự hoàn.* Lý do đầy đủ ở [ADR-0041](adr/0041-single-cancellation-deadline.md).

### 4. Đánh giá

Chỉ khách **đã thực sự đi** mới viết được đánh giá — hệ thống đòi mã đơn đã
thanh toán. Đánh giá viết xong chưa hiện ngay: nhân viên quản trị duyệt trước.
Khách có thể kèm ảnh, sửa lại bài của mình, hoặc rút bài xuống.

### 5. Liên hệ và bản tin

Khách gửi câu hỏi qua form (ở trang liên hệ hoặc ngay trong trang tour). Câu hỏi
vào một hàng đợi có trạng thái (mới → đã liên hệ → đã báo giá → thành công /
không thành công) để nhân viên theo dõi. Ngoài ra khách đăng ký nhận bản tin qua
email, và bỏ đăng ký bất cứ lúc nào bằng link trong mail.

### 6. Vận hành phía trong

Trang quản trị nằm ở tên miền riêng `admin.nexora-travel.agency`, và:

- Danh sách đơn kèm bộ lọc ngày, xuất file Excel.
- Hoàn tiền ngoại lệ, có ghi sổ ai làm và vì sao.
- Hàng đợi duyệt đánh giá.
- Sổ sự kiện thanh toán (mọi thứ cổng thanh toán báo về đều được lưu lại).
- Hàng đợi email chờ gửi, để biết mail nào kẹt.
- Bảng số liệu: doanh thu, số đơn, biểu đồ theo ngày, báo cáo tháng.
- Catalog: tạo và sửa tour theo từng bước (thông tin, lịch trình, câu hỏi
  thường gặp và chính sách, chi phí, ảnh), bật hoặc tắt đăng bán, lịch chuyến
  khởi hành của từng tour (kể cả công ty huỷ chuyến có hoàn tiền), danh mục và
  điểm đến. Danh mục và điểm đến ẩn hiện được, và chỉ xoá được khi chưa tour nào
  dùng.
- Bài viết blog: soạn, sửa, đăng và gỡ.
- Ảnh của trang web: thay 47 ô ảnh cố định của web, như ảnh lớn ở trang chủ.
- Thư viện ảnh: mọi ảnh đang dùng, sửa dòng ghi công tác giả một lần cho mọi chỗ
  dùng ảnh đó, và ảnh của từng điểm đến.
- Tài khoản (chỉ chủ trang): danh sách, cấp và thu quyền nhân viên, khoá và mở
  khoá, đăng xuất mọi nơi, lịch sử thay đổi của từng người.
- Nhật ký thao tác (chỉ chủ trang): mỗi lệnh ghi thành công trên trang quản trị
  để lại một dòng, để trả lời được câu hỏi "ai đã làm việc này, khi nào".

### 7. Trợ lý AI

Trên web có nút chat mở trợ lý AI. Trợ lý tìm tour theo yêu cầu của khách, trả
lời câu hỏi về một tour cụ thể, và gửi câu hỏi tới nhân viên thay khách khi khách
bấm đồng ý. Khách đã đăng nhập hỏi được về đơn của chính mình; trợ lý chỉ đọc,
không sửa hay huỷ đơn.

Mỗi lượt trả lời tốn tiền thật của chủ dự án, nên hệ thống đặt trần chi phí mỗi
ngày. Chạm trần thì nút chat ẩn tới hôm sau, và khách vẫn gửi câu hỏi được qua
form liên hệ. Lý do thiết kế ở [ADR-0050](adr/0050-ai-concierge-chat.md).

## Bốn phần mềm, một máy chủ

```text
   Khách                  Nhân viên               Khách (điện thoại)
     │                        │                          │
 ┌───▼────┐              ┌────▼────┐               ┌─────▼──────┐
 │  web   │              │  admin  │               │   mobile   │
 │ Next.js│              │ Next.js │               │    Expo    │
 └───┬────┘              └────┬────┘               └─────┬──────┘
     └──────────────┬─────────┴──────────────────────────┘
                    │  (tất cả đều gọi cùng một máy chủ)
              ┌─────▼──────┐        ┌──────────────┐
              │    api     ├────────► Postgres     │
              │   NestJS   │        │ (Supabase)   │
              └─────┬──────┘        └──────────────┘
                    │
  Stripe · PayPal · Cloudinary (ảnh) · Resend (email) · Anthropic (trợ lý AI)
```

**Mọi luật nghiệp vụ nằm ở máy chủ `api`.** Ba app kia chỉ hiển thị và thu thập
dữ liệu; chúng không tự quyết định giá, không tự kết luận đã thanh toán, không
tự tính được hoàn bao nhiêu. Đây là lý do gần như mọi tài liệu kỹ thuật trong
`docs/` đều xoay quanh máy chủ.

## Những gì chưa có

- Site không bán tour thật: thanh toán chỉ chạy ở chế độ thử của Stripe và PayPal.
- App điện thoại chỉ có bản Android dạng build thử, chưa lên cửa hàng ứng dụng;
  bản iOS chưa được thử trên máy thật.
- Chưa có xác thực hai lớp. Số điện thoại khách nhập chỉ để liên hệ, chưa được xác
  minh bằng mã SMS.
- Web chưa hiện dòng ghi công tác giả của ảnh; app và email đã hiện.
- Các biểu tượng mạng xã hội ở chân trang chưa trỏ tới tài khoản thật.
- Giao diện chỉ có tiếng Anh.

Danh sách đầy đủ, kèm lý do để lại, nằm ở [open-items.md](open-items.md) và
[sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).

## Vài con số (26/10/2026)

| | |
| --- | --- |
| Trang trên web khách | 32 |
| Trang trên web quản trị | 30 |
| Đường gọi máy chủ | 107 route khai trong contract, chưa tính các đường đăng nhập của Better Auth |
| Bảng dữ liệu | 37 |
| Test tự động | 9526 test, chạy trước mỗi lần gộp code: 8543 test thường và 983 integration test chạy với PostgreSQL thật |
| Tài liệu | 187 file Markdown trong `docs/` |

## Đọc tiếp

- Gặp từ lạ: [thuật ngữ](glossary.md).
- Muốn biết còn việc gì chưa làm: [open-items.md](open-items.md).
- Muốn hiểu vì sao làm thế này thay vì thế kia: [mục lục ADR](adr/README.md).
- Tìm một tài liệu bất kỳ: [bản đồ tài liệu](README.md).
- Muốn chạy dự án hoặc đọc code: [README của repo](../README.md).
