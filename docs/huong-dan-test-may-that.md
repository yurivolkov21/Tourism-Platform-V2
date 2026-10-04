# Hướng dẫn test app mobile trên máy thật

Dành cho người mới. Làm theo đúng thứ tự từng mục. Mỗi bước có **Kết quả mong đợi** để bạn đối chiếu. Nếu lệch, ghi lại theo mục 7.

Lưu ý quan trọng:
- Chỉ test với **thẻ thử** và dữ liệu thử. Không nhập thẻ thật, không dùng tài khoản thật của người khác.
- Một số bước cần dữ liệu đặc biệt (chuyến đang đi, chuyến đã kết thúc, review bị bác). Nhờ người phát triển chuẩn bị trước, không tự sửa cơ sở dữ liệu.

---

## 1. Chuẩn bị

### 1.1 Thiết bị và phần mềm

- Điện thoại Android, bật **gỡ lỗi USB** (Cài đặt → Tùy chọn nhà phát triển → Gỡ lỗi USB).
- Điện thoại cài sẵn **Expo Go** (từ Google Play).
- Máy tính chạy được `adb` (thư mục `platform-tools`).
- Điện thoại và máy tính **cùng một mạng Wi-Fi**.

Kiểm tra kết nối `adb`: cắm cáp USB, chấp nhận hộp thoại trên điện thoại, rồi chạy:

```bash
adb devices
```

**Kết quả mong đợi:** thấy một dòng có số serial và chữ `device`.

### 1.2 Chạy server

Người phát triển sẽ chạy:
- **API** (cổng 3001) và **Expo dev server** (cổng 8081).
- Expo hiện một địa chỉ dạng `exp://192.168.x.x:8081`. Ghi lại địa chỉ đó.

### 1.3 Mở app trên điện thoại

Mở Expo Go, hoặc chạy lệnh sau trên máy tính (thay `192.168.x.x` bằng địa chỉ Expo hiện):

```bash
adb shell am start -a android.intent.action.VIEW -d "exp://192.168.x.x:8081" host.exp.exponent
```

**Kết quả mong đợi:** app Nexora mở, hiện màn Khám phá hoặc Đăng nhập.

Nếu app báo lỗi kết nối API: kiểm tra điện thoại có cùng mạng với máy tính không, và API đã chạy chưa.

---

## 2. Tài khoản và dữ liệu thử

| Cần | Cách có |
| --- | --- |
| Tài khoản khách thử | Nhờ người phát triển cấp. Không dùng email thật của người khác |
| Booking chưa thanh toán (PENDING) | Đặt tour mới tới bước thanh toán rồi thoát (mục 3) |
| Booking đã thanh toán, ngày đi còn lâu | Có sẵn sau khi đặt và thanh toán thành công |
| Chuyến đang đi | Nhờ người phát triển đặt ngày đi về hôm nay |
| Chuyến đã kết thúc | Nhờ người phát triển đặt ngày về trước hôm nay |
| Review bị bác, review đã đăng, review đã rút | Nhờ người phát triển tạo |

---

## 3. Luồng A: Tìm tour và đặt tour

### A1. Tìm tour
1. Mở tab **Khám phá** (biểu tượng la bàn).
2. Gõ một từ khoá hoặc chọn một điểm đến (ví dụ Hà Nội).
3. Chạm một tour.

**Kết quả mong đợi:** danh sách lọc đúng theo từ khoá. Trang tour mở ra có ảnh, giá, ngày khởi hành.

### A2. Đặt tour
1. Ở trang tour, chọn một ngày khởi hành.
2. Chạm **Book now** (Đặt ngay).
3. Chọn số khách (người lớn, trẻ em) rồi chạm tiếp tục.
4. Điền thông tin liên hệ (tên, email, số điện thoại).
5. Ở bước xem lại, chọn cổng thanh toán rồi chạm **Pay** (Thanh toán).

**Kết quả mong đợi:** app chuyển sang bước checkout, có nút mở trình duyệt thanh toán.

### A3. Thanh toán bằng thẻ thử
1. Ở trình duyệt thanh toán, dùng thẻ thử đã công bố: số `4242 4242 4242 4242`, ngày hết hạn bất kỳ trong tương lai, CVC bất kỳ 3 số.
2. Hoàn tất thanh toán, quay lại app.

**Kết quả mong đợi:** màn "Đặt chỗ thành công" hiện đúng mã booking.

### A4. Thoát khi chưa thanh toán (kiểm tra trạng thái PENDING)
1. Đặt một tour mới, tới bước checkout.
2. **Không thanh toán.** Quay về màn chính (bấm nút quay lại hoặc tab khác).
3. Mở tab **Chuyến đi** (biểu tượng vali).

**Kết quả mong đợi:** booking vừa tạo hiện ngay trong danh sách với nhãn **Payment due** (Chờ thanh toán). Không cần tắt mở lại app.

Nếu không thấy booking, ghi lỗi (mục 7).

---

## 4. Luồng B: Chuyến đi

### B1. Danh sách chuyến (tab Chuyến đi)
1. Chạm chip **All**, rồi **Upcoming**, rồi **Past**.

**Kết quả mong đợi:**
- **All:** mọi booking, kể cả đã huỷ.
- **Upcoming:** chỉ chuyến chưa kết thúc (kể cả chuyến đang đi). **Không có** booking đã huỷ, đã hoàn.
- **Past:** chỉ chuyến đã đi xong. Không có booking đã huỷ.
- Chip được chọn có pill bo tròn đầy đủ, không bị cắt đáy.

### B2. Chuyến chưa thanh toán (T5)
1. Chạm thẻ **Payment due**.

**Kết quả mong đợi:** mở chi tiết booking, có nút **Pay** và **Cancel this booking**. Bấm Pay mở lại trang thanh toán.

### B3. Chuyến sắp đi (P1)
1. Chạm thẻ **Paid** có ngày đi trong tương lai.

**Kết quả mong đợi:** màn "Your trip" có số ngày đếm ngược, các mốc (đặt, thanh toán, hạn huỷ, khởi hành), mục "Get ready".

### B4. Chuyến đang đi (P5)
1. Nhờ người phát triển đặt ngày đi là hôm nay.
2. Mở tab Chuyến đi, tìm thẻ có nhãn **On tour now** (Đang đi).

**Kết quả mong đợi:**
- Thẻ có nhãn **On tour now** và nằm trong chip **Upcoming**.
- Chạm thẻ: tiêu đề hiện "Day N of M", có tiến độ, lịch trình hôm nay, mốc giờ đã qua gạch ngang.

### B5. Chuyến đã kết thúc (P6)
1. Nhờ người phát triển đặt ngày về trước hôm nay.
2. Mở chuyến đó.

**Kết quả mong đợi:** màn "Welcome back" với số ngày, số điểm đến, số khách (có đúng số ít/nhiều: "1 day", "1 traveller"). Có nút **Write a review**.

---

## 5. Luồng C: Đánh giá

### C1. Viết đánh giá (R1)
1. Ở P6, chạm **Write a review**.
2. Chạm một số sao (ví dụ 4 sao). Sao được chọn đổ đầy.
3. Nhập tiêu đề (tuỳ chọn).
4. Nhập nội dung. Bộ đếm `n/2000` hiện ngay. Nội dung phải có **ít nhất 10 ký tự**, nếu không nút gửi vẫn xám.
5. Chạm **Submit review** ở thanh đáy.

**Kết quả mong đợi:** màn "Thanks for your review" với pill **Pending review**, nút **Back to my trip**, link **See my reviews**.

Lưu ý: không chạm phím Back khi đang nhập, vì có thể thoát màn và mất nội dung.

### C2. Thêm ảnh (R2)
1. Ở màn viết đánh giá, chạm ô **+** trong mục ảnh.
2. Chọn **Choose from library**, chọn 2–3 ảnh cùng lúc.

**Kết quả mong đợi:**
- Mỗi ảnh hiện ở một ô, có vòng xoay khi đang tải lên, rồi hết vòng xoay.
- Tối đa 5 ảnh. Ảnh quá 10 MB hoặc không phải ảnh báo lỗi ngay trong khối ảnh.
- Nút gửi chỉ bật khi mọi ảnh đã tải xong.

### C3. Xem đánh giá của tôi (R4)
1. Ở màn **Thanks for your review**, chạm **See my reviews**. Hoặc mở tab **Account**, chạm **My reviews**.

**Kết quả mong đợi:** danh sách thẻ, mỗi thẻ có một pill trạng thái và ngày bên phải:
- **Published** (xanh): có link **Retract my review**.
- **Pending review** (vàng): không có nút.
- **Not published** (đỏ): có link **See why and rewrite**.
- **Retracted** (xám): không có nút.

### C4. Rút bài đã đăng (R7)
1. Trên thẻ **Published**, chạm **Retract my review**.
2. Đọc tấm xác nhận. Chạm nút rút (viền đỏ).

**Kết quả mong đợi:** thẻ đổi sang **Retracted** kèm ngày. Không còn nút. Việc này **không thể hoàn tác**, nên chỉ làm với bài thử.

### C5. Viết lại bài bị bác (R5)
1. Trên thẻ **Not published**, chạm **See why and rewrite**.

**Kết quả mong đợi:**
- Banner đầu trang: "Your review wasn't published", nhãn **Why**, lý do của người duyệt (nếu có).
- Nội dung, sao, tiêu đề được điền sẵn từ bài cũ.
- Ảnh cũ hiện sẵn, gỡ được; có thể thêm ảnh mới.
- Nút **Send for review again** ở thanh đáy.

Nếu còn đúng một lượt viết lại, có dòng "One more rewrite left…".

### C6. Hết lượt viết lại (R6)
1. Trên thẻ đã bị bác đủ 2 lần, chạm **See why and rewrite**.

**Kết quả mong đợi:** màn "We've looked at this review twice", hiện lý do cuối cùng, nút **Contact us** mở form liên hệ, link quay lại.

---

## 6. Luồng D: Tài khoản

### D1. Help & legal
1. Tab **Account**, chạm **Help & legal**.

**Kết quả mong đợi:** tấm liệt kê 5 mục: Help & FAQ, About Nexora, Cancellation & refund policy, Privacy policy, Terms of service. Chạm một mục: tấm đóng lại và trình duyệt mở trang trên website thật.

### D2. Personal details và đổi mật khẩu
1. Tab **Account**, chạm **Personal details** (nếu có trong menu) hoặc vào từ đầu trang tài khoản.
2. Chạm dòng **Password** có mũi tên.

**Kết quả mong đợi:** mở màn đổi mật khẩu. Dòng Password không còn nằm trong menu chính Account.

---

## 7. Ghi lỗi

Khi thấy kết quả khác mong đợi, ghi lại:
1. **Tên luồng và mục** (ví dụ "C2 – Thêm ảnh").
2. **Các bước đã làm**, theo thứ tự.
3. **Điều thấy được** và **điều mong đợi**.
4. **Ảnh chụp màn hình** (nếu có).
5. **Thời gian** (giờ điện thoại) và tài khoản đang dùng.

Gửi cho người phát triển. Không gửi mật khẩu hay mã thẻ.

---

## 8. Sau khi test

- Nhờ người phát triển xoá các booking, review, và ngày đi đã đổi dùng để test.
- Không để lại dữ liệu test trên tài khoản thật.
- Thoát Expo Go nếu không còn test.
