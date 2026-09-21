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

Website chạy thật trên Internet tại **www.nexora-travel.agency**, nhưng **không ai
mất tiền thật**: cổng thanh toán Stripe và PayPal luôn ở chế độ thử nghiệm — thẻ
dùng để thử là thẻ giả do chính Stripe/PayPal cấp.

## Ai dùng, và làm được gì

| Người dùng | Cần đăng nhập? | Làm được gì |
| --- | --- | --- |
| **Khách vãng lai** | Không | Xem tour, xem điểm đến, đọc blog, gửi câu hỏi, đăng ký nhận bản tin |
| **Khách có tài khoản** | Có | Tất cả những việc trên, cộng: đặt tour, trả tiền, xem chuyến của mình, tự huỷ, lưu tour yêu thích, viết và sửa đánh giá |
| **Nhân viên quản trị** | Có, và phải có quyền admin | Xem toàn bộ đơn, hoàn tiền ngoại lệ, duyệt/từ chối đánh giá, theo dõi câu hỏi khách gửi, xem báo cáo doanh thu |

Hệ thống chỉ có **hai mức quyền**: khách (`CUSTOMER`) và quản trị (`ADMIN`).
Không có vai trung gian nào.

## Sáu luồng chính

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

## Bốn phần mềm, một máy chủ

```
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
      Stripe · PayPal · Cloudinary (ảnh) · Resend (email)
```

**Mọi luật nghiệp vụ nằm ở máy chủ `api`.** Ba app kia chỉ hiển thị và thu thập
dữ liệu; chúng không tự quyết định giá, không tự kết luận đã thanh toán, không
tự tính được hoàn bao nhiêu. Đây là lý do gần như mọi tài liệu kỹ thuật trong
`docs/` đều xoay quanh máy chủ.

## Vài con số (21/09/2026)

| | |
| --- | --- |
| Trang trên web khách | 32 |
| Trang trên web quản trị | 12 |
| Endpoint máy chủ | ~110, chia 12 nhóm |
| Bảng dữ liệu | 35 |
| Test tự động | 3.689 (Vitest) + 245 (Jest, mobile) + 497 (integration) |
| Tài liệu | 159 file Markdown |

## Đọc tiếp gì

- Không rành thuật ngữ → [glossary.md](glossary.md)
- Muốn biết còn nợ việc gì → [open-items.md](open-items.md)
- Muốn hiểu vì sao làm thế này thay vì thế kia → [bản đồ tài liệu](README.md),
  mục ADR
- Muốn bắt tay vào code → [README của kho mã](../README.md)
