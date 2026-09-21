# Lịch sử dự án — mục lục lưu trữ

> Kể lại dự án đã đi qua những gì, theo thứ tự thời gian, bằng ngôn ngữ thường.
> Mỗi giai đoạn trỏ tới file lưu trữ giữ **bản ghi gốc** của nó. Đợt đang chạy
> nằm ở [`../CHANGELOG.md`](../CHANGELOG.md).
>
> Trang này viết ngày 21/09/2026 và là phần **thêm mới** — không một ký tự nào
> của entry cũ bị sửa khi tách file.

## Tra nhanh

| Giai đoạn | Thời gian | Lưu trữ |
| --- | --- | --- |
| 1. Khung xương và API lõi | 18/07–22/07 | [p0-p3a-backend](2026-07-p0-p3a-backend.md) |
| 2. Giao diện web tĩnh | 22/07–28/07 | [p3b-static](2026-07-p3b-static.md) |
| 3. Nối web vào API | 30/07–07/08 | [web-api-wiring](2026-08-web-api-wiring.md) |
| 4. Đập đi xây lại tài khoản và thanh toán | 08/08–13/08 | [redesign-account-checkout](2026-08-redesign-account-checkout.md) |
| 5. Ảnh thật thay ô giữ chỗ | 14/08–18/08 | [real-images](2026-08-real-images.md) |
| 6. Rà toàn site và lên sóng | 19/08–20/08 | [site-sweep-deploy-v1](2026-08-site-sweep-deploy-v1.md) |
| 7. Trang quản trị | 31/08–03/09 | [p4-admin-areas](2026-09-p4-admin-areas.md) |
| 8. Chỉnh giao diện admin và bộ lọc | 04/09 | [admin-ui-and-filters](2026-09-admin-ui-and-filters.md) |
| 9. Luật hoàn tiền, đánh giá, tài chính | 04/09–05/09 | [refund-policy-and-reviews](2026-09-refund-policy-and-reviews.md) |
| 10. Bốn đợt vá bảo mật | 06/09–08/09 | [security-w1-w4](2026-09-security-w1-w4.md) |
| 11. Supabase, thư viện, app điện thoại | 09/09 | [supabase-deps-mobile](2026-09-supabase-deps-mobile.md) |
| 12. Dữ liệu trọn năm và máy dev mới | 10/09–15/09 | [data-and-machine](2026-09-data-and-machine.md) |
| **Đang chạy** | 15/09– | [`../CHANGELOG.md`](../CHANGELOG.md) |

## Câu chuyện

### 1. Khung xương và API lõi (18/07–22/07)

Dựng monorepo, rồi xây máy chủ trước giao diện: danh mục tour, đặt chỗ, thanh
toán, đánh giá, danh sách yêu thích, câu hỏi khách, bản tin, blog. Hai quyết
định lớn của giai đoạn này còn giữ đến giờ — cổng thanh toán nằm sau một lớp
trừu tượng chung, và mọi khoản hoàn tiền đi vào một cuốn sổ chỉ-ghi-thêm.

### 2. Giao diện web tĩnh (22/07–28/07)

19 trang dựng bằng dữ liệu giả: trang chủ, giới thiệu, liên hệ, sáu trang đăng
nhập, blog, pháp lý, danh sách tour và trang chi tiết. Cùng lúc chốt bộ màu, bộ
chữ và thư viện component dùng chung.

### 3. Nối web vào API (30/07–07/08)

Bảy bước thay dần dữ liệu giả bằng dữ liệu thật, mỗi bước một cụm trang. Kết
thúc giai đoạn, site có hành vi ghi thật: gửi được câu hỏi, đăng ký bản tin,
đăng nhập, đặt chỗ và đi qua cổng thanh toán.

### 4. Đập đi xây lại tài khoản và thanh toán (08/08–13/08)

Khu tài khoản làm lại ba lần trong sáu ngày rồi mới chốt ở thế giới "Hộ chiếu" —
một bài học đắt về việc thiết kế trước khi dựng. Cùng đợt: trang thanh toán đổi
hướng, khách bắt đầu tải được ảnh đại diện và ảnh đánh giá lên, trang chi tiết
tour chuyển từ cuộn-dài sang 5 tab.

### 5. Ảnh thật thay ô giữ chỗ (14/08–18/08)

Lô ảnh đầu bị loại **toàn bộ**: bộ lọc theo toạ độ chứng minh được ảnh chụp ở
đâu nhưng không chứng minh được nó chụp **cái gì** — một tấm ảnh bãi rác ở Hạ
Long qua sạch mọi cửa kiểm. Sửa bằng cách đổi vai: người chọn ảnh, máy chỉ
khuân. Sau đó ảnh thật có ghi công giấy phép phủ dần toàn site.

### 6. Rà toàn site và lên sóng (19/08–20/08)

Rà 31 route bằng máy lẫn bằng mắt, dựng wizard đặt chỗ 4 bước, viết email giao
dịch bằng mã thay vì dashboard, rồi đưa site lên sóng thật tại
`nexora-travel.agency`. Từ mốc này, mọi lần đẩy mã lên `main` là sửa đồ đang
chạy.

### 7. Trang quản trị (31/08–03/09)

App riêng ở tên miền con, dùng chung phiên đăng nhập với web khách. Mười vùng mở
lần lượt: đơn hàng, hoàn tiền, duyệt huỷ, duyệt đánh giá, báo cáo, hàng đợi
email, sổ webhook, câu hỏi khách, danh sách nhận tin.

### 8. Chỉnh giao diện admin và bộ lọc (04/09)

Bốn ô lọc gộp thành một menu. Quan trọng hơn: phát hiện ba vùng admin có thẻ số
liệu và bảng ngay bên dưới đang trả lời **hai câu hỏi khác nhau** — thẻ đếm 28
ngày trượt trong khi bảng lọc theo tháng. Sửa để thẻ ăn theo đúng bộ lọc người
dùng chọn.

### 9. Luật hoàn tiền, đánh giá, tài chính (04/09–05/09)

Chính sách hoàn tiền từ chỗ chỉ là văn bản trở thành luật cưỡng chế, một nguồn
duy nhất nuôi cả trang pháp lý lẫn phép tính. Đánh giá có thêm trạng thái "đã
bác" và đường viết lại cho tác giả. Báo cáo tháng chuyển từ đếm dòng tiền sang
có kết quả kinh doanh. Dashboard nối số thật.

### 10. Bốn đợt vá bảo mật (06/09–08/09)

Sau một đợt rà nhìn từ phía kẻ tấn công, bốn đợt vá theo thứ tự rủi ro: **W1**
tiền (một phiên thanh toán sống mỗi đơn, không nuốt khoản thu thừa), **W2**
phiên đăng nhập và hạ tầng, **W3** vỏ Next và chính sách bảo mật nội dung,
**W4** kênh vào và email đi ra. Mỗi đợt khép bằng một vòng review tám mũi.

### 11. Supabase, thư viện, app điện thoại (09/09)

Tắt hai bề mặt của Supabase mà dự án không dùng nhưng vẫn mở ra Internet. Đóng
26 cảnh báo thư viện. Dựng khung ứng dụng điện thoại đầu tiên.

### 12. Dữ liệu trọn năm và máy dev mới (10/09–15/09)

Seed lại toàn bộ dữ liệu cho trọn năm 2026 rồi đẩy lên cơ sở dữ liệu thật, viết
alt text cho 517 ảnh. Giữa đợt, máy dev phải dựng lại từ đầu sang Windows
native.

### Đợt đang chạy (15/09–)

Thay ba luật hoàn tiền chồng nhau bằng **một hạn chót cho mỗi chuyến**, dựng bản
vẽ cho bốn cụm màn điện thoại còn lại, và các đợt vá nhỏ. Xem
[`../CHANGELOG.md`](../CHANGELOG.md).

## Luật của thư mục này

Entry đã ghi là **bất biến**, cùng luật với `migration.sql`: tách file là di
chuyển nguyên văn, không sửa một ký tự. Muốn đính chính điều gì thì viết entry
mới ở `../CHANGELOG.md`, đừng sửa entry cũ.

[`2026-07-p3b-static.md`](2026-07-p3b-static.md) có 4 dòng bắt đầu bằng `+` ở
cột 0 — đó là **phép cộng** số test bị ngắt dòng, không phải gạch đầu dòng. Mở
rồi save bằng editor có markdownlint sẽ đổi `+` thành `-` và làm sai con số đã
ghi. Mười một file còn lại hiện sạch; giữ vậy.
