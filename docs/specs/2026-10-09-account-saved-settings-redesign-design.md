# Thiết kế lại `/account/saved` và `/account/settings`

- **Trạng thái:** user duyệt thiết kế 09/10/2026 (chọn Settings C, Saved A từ wireframe).
- **Bản ghi wireframe:** [`account-saved-settings.src.html`](../design/mockups/account-saved-settings.src.html) — trang
  so sánh ba phương án mỗi trang, khung 1280px và 375px. Bản ghi bất biến (luật mockup).
- **Nguồn mẫu** (user chỉ định): ReUI (Settings 7, Wishlist 1–3, Product Card 1), shadcn/studio (Account
  Settings 01 và 09, Product List 09), Shadcn UI Kit (Form Layout 19, Product Card 9 và 10), shadcnspace (User
  Profile 02), ui.shadcn.com (Forms example, Field responsive).
- **Liên quan:** spec khu account 08/08 ([2026-08-08-account-redesign-design.md](2026-08-08-account-redesign-design.md));
  P7 Phần A (nút tròn quay lại trong hero, `ContentHero.back`).

## 1. Phạm vi

Chỉ đổi giao diện (user chọn 09/10): giữ nguyên chức năng, API và contract. Không thêm sắp xếp, lọc, tuỳ chọn
thông báo hay đổi email. Freeze 15/10.

Hai trang đang còn link chữ "← Passport" dưới hero và bố cục cũ. Cả hai đổi link đó thành nút tròn quay lại
trong hero (`ContentHero.back`, nhãn đọc "Back to Passport", về `/account`), giống My bookings. Chữ của hero
giữ nguyên.

## 2. Settings — phương án C: thẻ danh tính trái, các thẻ thông tin phải

**Từ `lg` (1024px):** hai cột, cột trái 320px, khe 24px, khung rộng tối đa 1024px giữa trang.

- **Thẻ danh tính (cột trái, dính khi cuộn):** ảnh đại diện 96px dùng lại `AvatarUpload` (bấm hoặc kéo thả bằng
  chuột, thanh tiến độ, lỗi, nút gỡ ảnh — hành vi không đổi), tên (chữ serif), email (muted), nút viền "Upload avatar",
  dòng gợi ý cỡ ảnh. Nút viền là điểm dừng "Upload avatar" DUY NHẤT của bàn phím và trình đọc màn hình — ảnh tròn và ô
  chọn file ẩn khỏi cả hai, để Tab không dừng hai lần cùng một tên. Tên và email dài không dấu cách (email 47 ký tự) bẻ
  dòng trong thẻ chứ không làm thẻ phình; tài khoản không khai tên thì bỏ dòng tên. Dưới một vạch ngăn: nhãn nhỏ
  "Connected accounts" và dòng "Email & password" có icon thư — mục Connected accounts cũ gộp vào đây.
- **Cột phải, ba khối xếp dọc:**
  1. Thẻ **Personal information**: dòng Full name, Phone (kèm gợi ý "So the guide can reach you on the day."),
     Email (kèm "Can't be changed yet", không có nút sửa). Sửa ngay tại dòng như hiện tại: dòng đang mở tô nền
     nhạt, ô nhập và Save/Cancel nằm trong dòng.
  2. Thẻ **Password**: tách khỏi nhóm trên thành thẻ riêng; dòng mật khẩu che `••••••••••` và nút Edit; mở thì form
     ba ô hiện có (`ChangePasswordForm`) nằm trong thẻ.
  3. Khối **Danger zone**: viền đỏ nhạt, tiêu đề đỏ, chỉ dòng Delete account tô nền đỏ rất nhạt; nút mở hộp xác
     nhận hiện có (`DeleteAccount`, mọi thông báo lỗi giữ nguyên).
- Mỗi thẻ: tiêu đề serif kèm một dòng mô tả muted, thân là các dòng "nhãn trái — giá trị — hành động phải" ngăn
  bằng vạch mảnh.

**Dưới `lg`:** một cột; thẻ danh tính lên đầu (không dính), rồi ba khối như trên. Trong thẻ, mỗi dòng xếp hai hàng:
nhãn và nút Edit trên một hàng, giá trị ở hàng dưới. Gutter 16px, không cuộn ngang ở 320px (kể cả khi email hay tên
rất dài).

**Không đổi:** dữ liệu (`fetchAccountMe`), các form và toast, luồng xoá tài khoản. Hai thẻ Personal information và
Password có thể cùng mở một dòng mỗi thẻ (mỗi thẻ giữ trạng thái mở của riêng nó).

## 3. Saved — phương án A: lưới thẻ ảnh, tim nổi trên ảnh

- **Lưới:** 1 cột dưới `sm`, 2 cột từ `sm`, 3 cột từ `lg`; khung rộng tối đa 1152px; khe ngang 24px, dọc 32px.
- **Thẻ (không viền, cùng dáng thẻ tour ở `/tours`):** ảnh bìa 4:3 bo góc (`SlotImage`, `sizes` theo số cột); nút tim
  36px ở góc phải trên ảnh, LUÔN hiện ở mọi khổ — nền trắng mờ có `backdrop-blur` và bóng nhẹ, tim đặc màu chủ đạo,
  là nút hành động thuần, KHÔNG `aria-pressed` (thẻ rời lưới ngay khi bấm nên không bao giờ có trạng thái "chưa bấm";
  `aria-pressed="true"` cộng nhãn "Remove …" thì trình đọc màn hình đọc "toggle button, pressed" — tự mâu thuẫn), tên
  đọc "Remove {tour} from saved tours" (khoá có sẵn), thay nút X hiện tại. Dưới ảnh:
  dòng nhỏ "Saved {ngày}" (từ `addedAt`, ngày lịch Việt Nam, dạng `3 Oct`; khác năm hiện tại thì thêm năm) → tên
  tour chữ serif (tối đa 2 dòng) → số ngày kèm điểm sao và số lượt (ẩn phần sao khi tour chưa có đánh giá) → giá
  như thẻ hiện tại. Cả thẻ là một vùng bấm tới trang tour; nút tim nằm trên vùng bấm.
- **Tour không còn bán (`unavailable`):** ảnh xám, nhãn "No longer available" ở góc trái trên ảnh, tên chữ muted,
  không giá, thẻ không bấm được; tim vẫn bỏ lưu được.
- **Bỏ lưu:** giữ hành vi hiện có — thẻ rời lưới ngay; lỗi thì thẻ quay về đúng chỗ cũ kèm toast. Thêm: số tour ở
  hero cập nhật sau khi bỏ thành công (hiện giờ đứng yên tới khi tải lại trang).
- **Focus khi bỏ lưu bằng bàn phím:** nếu tim của thẻ vừa bỏ đang giữ focus thì focus dời sang tim của thẻ kế (thẻ
  trước nếu đó là thẻ cuối; lưới trống thì sang nút "Browse tours"), không để rơi về `body` rồi bắt người dùng Tab
  lại từ đầu trang. Focus đang ở chỗ khác thì giữ nguyên.
- **Trạng thái trống:** khối giữa trang — icon tim trong vòng tròn nền muted, "Nothing saved yet", câu hướng dẫn có
  sẵn, nút chính "Browse tours".

## 4. Chữ (`@tourism/i18n`, tiếng Anh)

- Gỡ `accountSaved.back` và `passportSettings.back` ("← Passport") khi không còn nơi đọc; nhãn nút quay lại dùng
  chung một khoá "Back to Passport" (đang ở `accountBookings.backToPassport`).
- Thêm: `accountSaved.savedOn(date)` → "Saved {date}"; mô tả của thẻ Password ("Change the password you sign in
  with."). Còn lại dùng khoá có sẵn của `accountProfile` và `accountSaved`.

## 5. Kiểm thử

- Unit (Vitest): thẻ đã lưu (ngày lưu, ẩn sao khi chưa đánh giá, nhánh unavailable, tim là nút hành động không
  `aria-pressed` với tên đọc), lưới bỏ lưu (rời ngay, quay lại khi lỗi, số đếm hero cập nhật, focus dời sang thẻ kế khi
  bỏ bằng bàn phím), trang settings xếp đúng thẻ và đủ dòng, thẻ Password mở form, nút quay lại trong hero của hai
  trang.
- Đo bố cục ở 320/375/768/1024/1280 (cả theme tối): không cuộn ngang, chữ không đè, thẻ danh tính dính đúng ở `lg`.
- Thử tay trên production sau deploy, từng bước (đăng nhập do user làm).

## 6. Ngoài phạm vi

Sắp xếp và lọc tour đã lưu, chọn nhiều, chia sẻ; tuỳ chọn email; đổi email.
