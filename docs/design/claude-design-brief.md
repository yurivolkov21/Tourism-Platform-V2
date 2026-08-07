# Design brief — tourism-v2 (upload vào Claude Design)

> **File này để LÀM GÌ:** upload một lần vào project Claude Design, để mọi trang
> bạn thiết kế ở đó bám đúng ngôn ngữ thiết kế của sản phẩm thật.
>
> **File này KHÔNG phải nguồn sự thật.** Nó là bản trích, biên soạn ngày
> 03/08/2026 từ: `docs/conventions/color-system.md`, ADR-0012 (typography),
> ADR-0013 (tokens), ADR-0015 (rút tint vùng), `app/layout.tsx`,
> `libs/shared/ui/src/components/`. Khi hai bên lệch, **code thắng** — sửa file
> này theo code.
>
> Đã loại bỏ có chủ ý: mục "90/10 tint theo vùng" của color-system.md. ADR-0015
> (29/07/2026) rút lớp đó khỏi toàn site. Bản sắc vùng từ nay do **cấu trúc**
> gánh (bố cục khác nhau, copy riêng), **không** do màu.

---

## 1. Sản phẩm là gì

Nền tảng đặt tour du lịch Việt Nam. Khách duyệt tour, xem lịch trình, chọn đợt
khởi hành, đặt chỗ, thanh toán. Đây là một trang thương mại thật về mặt giao
diện và trải nghiệm.

Giọng điệu: **điềm đạm, tin cậy, không hò hét.** Không dùng khan hiếm giả
("chỉ còn 2 chỗ!!!" khi không phải), không dùng đếm ngược, không popup khuyến mãi.

---

## 2. Màu — dùng ĐÚNG những giá trị này, không tự chế

Palette lấy cảm hứng từ tranh thủy mặc — sương, trúc, nước sông, mực tàu. Chủ đạo
là **ngọc bích trầm trên nền sương phớt lục**, không phải xanh dương SaaS.

### Light

| Vai trò | Hex |
| --- | --- |
| Primary (nút chính, link, focus ring) | `#2E6E66` |
| Primary hover/đậm | `#24544E` |
| Nền trang | `#F5F8F7` |
| Card / bề mặt nổi | `#FDFEFD` |
| Muted / chip / dải section | `#DCE5E2` |
| Border | `#AEBBB8` |
| Chữ phụ | `#4F605C` |
| Chữ chính | `#1B2B2B` |
| Destructive (lỗi, hủy) | `#A8423A` |
| Rating ★ (CHỈ dùng cho sao đánh giá) | `#D99A3D` |

### Dark — bắt buộc thiết kế cả hai

| Vai trò | Hex |
| --- | --- |
| Nền trang | `#202A28` |
| Card / bề mặt | `#243430` |
| Border | `#3A4D47` |
| Chữ chính | `#DCE8E4` |
| Chữ phụ | `#9DB3AC` |

### Ramp đầy đủ (khi cần sắc độ trung gian)

Ngọc: `#EDF4F2 · #C9DDD9 · #8FBAB2 · #4C8D83 · #2E6E66 · #24544E · #1B3B36`
Trung tính: `#F5F8F7 · #DCE5E2 · #AEBBB8 · #7D8F8B · #4F605C · #2C3B39 · #1B2B2B`

### Luật liều lượng — quan trọng hơn mã màu

Tỷ lệ đúc kết từ các trang đã được duyệt:

là **sương ~62% · celadon ~16% · ngọc ~12% · mực ~6% · đỏ+vàng vài %**

Cái đẹp nằm ở liều lượng. Một trang phủ đầy màu primary là **sai**, dù dùng đúng
mã. Ngọc bích để dành cho hành động chính và điểm nhấn.

### Cấm

- Không dùng màu nào ngoài bảng trên. Không gradient cầu vồng, không tím/hồng.
- Không tô màu khác nhau theo miền Bắc/Trung/Nam (đã rút, xem đầu file).
- Vàng hổ phách `#D99A3D` **chỉ** dùng cho sao rating, không dùng làm accent chung.

---

## 3. Chữ

Ba họ, mỗi họ một vai trò rõ ràng, đều có subset tiếng Việt đủ dấu:

| Họ | Vai trò |
| --- | --- |
| **Literata** (serif) | Mọi heading. Có italic thật — dùng cho dòng accent. |
| **Archivo** (grotesque) | Thân bài, nhãn, nút, form — toàn bộ UI. |
| **IBM Plex Mono** | Mã đặt chỗ, số kỹ thuật, mã tham chiếu giao dịch. |

Heading serif trên thân grotesque là **chữ ký nhận diện** của site. Đừng đổi
heading sang sans — mất luôn bản sắc.

Nội dung dài (mô tả tour, chính sách, bài blog) chạy qua hệ typography riêng với
ba mức: **docs** (rộng rãi, mặc định) · **chat** (chặt, cỡ nhỏ) · **reading**
(thoáng, cỡ lớn hơn — trang đọc dài).

---

## 4. Component đã có sẵn — hãy dùng lại, đừng phát minh

Dự án có sẵn **63 primitive** (shadcn style `base-nova` trên Base UI). Thiết kế
trang mới **phải lắp từ những thứ này**; mỗi component bạn nghĩ ra ngoài danh
sách là một thứ ai đó phải viết mới.

```text
accordion · alert · alert-dialog · animated-theme-toggler · aspect-ratio ·
attachment · avatar · badge · breadcrumb · bubble · button · button-group ·
button-link · calendar · card · carousel · chart · checkbox · collapsible ·
combobox · command · context-menu · dialog · direction · drawer · dropdown-menu ·
empty · field · hover-card · input · input-group · input-otp · item · kbd ·
label · marker · menubar · message · message-scroller · navigation-menu ·
pagination · popover · progress · radio-group · resizable · scroll-area ·
select · separator · sheet · sidebar · skeleton · slider · sonner · spinner ·
stepper · switch · table · tabs · textarea · toggle · toggle-group · tooltip ·
typeset
```

Ghi chú vài cái đáng dùng mà dễ quên: **stepper** (luồng nhiều bước như đặt chỗ),
**field** (nhãn + input + lỗi + mô tả, đúng một khối), **empty** (trạng thái
rỗng), **item** (dòng danh sách), **input-otp** (mã 2FA), **marker** (điểm nhấn
trong văn bản).

---

## 5. Khuôn mẫu bố cục mà site đang dùng

Bám các khuôn này để trang mới trông cùng một nhà:

- **Hero luôn TỐI.** Mọi trang có hero (`/tours`, `/contact`, `/destinations`,
  trang vùng) dùng nền tối cộng một hoạ tiết đường đồng mức mảnh, chữ sáng đè lên.
  Không có ngoại lệ — navbar chưa cuộn dùng chữ trắng và sẽ tàng hình trên hero sáng.
- **Ảnh: dùng ô placeholder, đừng dùng ảnh thật.** Sản phẩm đang ở chính sách
  static-first — mọi vị trí ảnh là ô nền xám sọc chéo mảnh, có icon và nhãn mô tả
  ảnh sẽ nằm ở đó. Mockup nên theo đúng vậy để không hứa hẹn thứ chưa có.
  **Ngoại lệ DUY NHẤT (06/08): khu Location của `/contact` là bản đồ MapLibre
  THẬT**, tương tác được, 2 pin Hà Nội và Hồ Chí Minh, tile đổi theo sáng/tối
  ([ADR-0018](../adr/0018-web-map-library.md)). Bản đồ là component *chức năng*
  chứ không phải ô ảnh — chính sách placeholder không áp cho nó. Mockup nào chạm
  `/contact` phải vẽ bản đồ thật, đừng vẽ ô sọc chéo ở đó.
- **Padding trang:** hẹp ở mobile, nới dần tới rất rộng ở màn lớn. Nội dung
  không tràn sát mép ở desktop.
- Bo góc vừa phải, viền mảnh 1px, đổ bóng rất nhẹ hoặc không có. Không neumorphism,
  không glassmorphism.

---

## 6. Luật cứng

1. **Mọi chữ hiển thị bằng tiếng Anh.** Không tiếng Việt trong nhãn, nút, thông
   báo, email — kể cả khi bạn đang đọc brief tiếng Việt này. Địa danh giữ dấu
   tiếng Việt (Hạ Long, Ninh Bình).
2. **Thiết kế cả light và dark.** Dark không phải bản đảo màu — dùng đúng bảng ở §2.
3. **Không doanh thu thật.** Đây là đồ án; thanh toán luôn ở chế độ test. Đừng
   thiết kế thứ ngụ ý giao dịch thật (biên lai giống thật, con dấu ngân hàng…).
4. **Đừng bịa dữ liệu có vẻ chính thức** — không giấy chứng nhận, không huy hiệu
   "đã xác minh" nếu dữ liệu công khai không xác nhận được điều đó.
5. **Accessibility:** tương phản chữ/nền tối thiểu 4.5:1. Trạng thái focus phải
   nhìn thấy rõ, dùng ring màu primary.

---

## 7. Trang đã có (để tham chiếu phong cách, đừng thiết kế lại)

Home · About · Blog + bài viết · Contact · FAQ · Destinations + trang vùng ·
Tours (danh sách) · Tour chi tiết · Login/Register/Forgot/Reset/2FA/Verify email ·
Terms/Privacy/Cancellation policy.

**Chưa có:** Booking (luồng đặt chỗ) — `/tours/[slug]/book`, `/checkout/success`,
`/checkout/cancel` đều chưa tồn tại, dù API đã trỏ redirect vào hai URL sau.

**Đã ship nhưng ở mức DỰNG TẠM, đang cần thiết kế lại:** cả khu account merge
06/08 với điều kiện rõ ràng là sẽ redesign — `/account` (dashboard) ·
`/account/bookings` · `/account/bookings/[code]` · `/account/profile` ·
`/account/saved`. Lưu ý `/account/security` KHÔNG phải trang: nó là
`permanentRedirect` 308 sang profile, nên chỉ có **5 màn thật**. Chi tiết nợ:
[sổ nợ kỹ thuật mục A](../analysis/2026-08-06-backlog-no-ky-thuat.md).
