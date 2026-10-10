# ADR-0057 — Bản in là một tài liệu riêng: component chỉ-in, trang in `doc` khổ A4 lề 0, khung đầu và chân trang chung

- **Trạng thái:** Accepted (2026-10-10) — user chốt bằng mắt bốn bản thảo cùng ngày (voucher
  5b, hoá đơn chờ B1, báo cáo tháng C2, Excel D1) rồi duyệt hướng kỹ thuật dưới đây.
- **Bối cảnh thi hành:** đợt G40 ([open-items](../open-items.md)), spec
  [2026-10-10-print-and-export-redesign-design.md](../specs/2026-10-10-print-and-export-redesign-design.md).
  Đi trước code theo luật CLAUDE.md #5.
- **Liên quan:** [ADR-0034](0034-excel-report-export.md) (AMEND 3 cùng ngày: danh sách xuất
  Excel thay CSV) · [ADR-0054](0054-customer-bookings-list-phase-filters.md) (giai đoạn đơn —
  biến thể của bản in đi theo `bookingPhase`) · spec P7 §6.4 (bản in voucher cũ — ADR này thay
  cách làm) · G32, G37, G40.

## Bối cảnh

Thử tay production 09/10 (bước 9 của spec P7 §11) in voucher `/checkout/success` của
BK-EET0JBTH: bản in chạy được — chỉ in thẻ, hai cột, gọn một trang — nhưng user chê "như làm
đại". Đo được: email gãy giữa chữ ("nora.dahl@exampl / e.com"), tiêu đề gãy dòng, mộc
CONFIRMED chen sát tiêu đề, một phần ba dưới trang trống, không logo, trình duyệt tự in kèm
ngày giờ, tiêu đề tab và URL.

Rà 10/10 thấy cả ba bản in của dự án cùng một bệnh:

- **Voucher** — `@media print` ở `apps/web/src/app/globals.css` đè biến màu và ép lưới hai cột
  lên chính markup màn hình (biến thể `voucher-split:` / `voucher-stack:`).
- **Hoá đơn chờ** (`BookingReceipt`, đơn chưa trả) — không có khối in riêng: in cả thanh trên
  cùng, navbar, hero nền tối, footer, và nút Copy của cuống.
- **Báo cáo tháng admin** — một khối `@media print` chung cho mọi trang admin (trắng đen, lề
  14 mm); không logo, không đầu hay chân trang.

Gốc chung: mỗi bản in là *trang web đem in*, không phải *tờ giấy được thiết kế*. Bố cục web phải
chạy từ 320 tới 1536 px; tờ giấy chỉ có một khổ 210 × 297 mm. Hai bài toán khác nhau dùng chung
một bộ markup thì một bên luôn phải chịu — và lịch sử P7 đã cho thấy bên chịu là bản in: sửa
màn hình là vỡ bản in (review P7C#7, #13).

## Quyết định

### 1. Mỗi bản in là một component chỉ-in, đặt cạnh nội dung màn hình trên cùng trang

- Áp cho `/checkout/success` (voucher của đơn đã trả · hoá đơn chờ của đơn chưa trả),
  `/checkout/cancel` (hoá đơn chờ) và admin `/reports` (báo cáo tháng).
- Nội dung màn hình bọc `print:hidden`; tài liệu in render cùng request, ẩn trên màn hình
  (`hidden print:flex` — cột dọc để chân trang dính đáy), đánh dấu `data-print-doc`.
- Tài liệu in dùng CHUNG view-model với màn hình (`voucherView`, `bookingPass`,
  `refundSentence`, `reports-view`…) — hai bộ markup, một nguồn sự thật. Không gọi API thêm
  ngoài dữ liệu trang đã có, trừ ngoại lệ ở §4.
- Nút Print giữ `window.print()`; Ctrl+P cho cùng kết quả.
- Chrome của site giấu bằng một luật neo vào tài liệu: `body:has([data-print-doc]) > :not(main)
  { display: none }` — thay luật đang neo `[data-slot="voucher"]`.

### 2. Trang in tên `doc`: A4, lề 0

- `@page doc { size: A4; margin: 0 }` và `[data-print-doc] { page: doc }`. Chỉ tài liệu in
  dùng trang này; in một trang khác của site (bài blog, trang tour) vẫn lề mặc định.
- Lề 0 là cách DUY NHẤT tắt đầu và chân trang tự động của trình duyệt (ngày giờ, tiêu đề tab,
  URL) mà không bắt người in bỏ tích "Headers and footers". Tài liệu tự đệm 11–15 mm bên trong
  khổ — dư chỗ cho vùng không in được của máy in gia đình (~4 mm).
- Một tài liệu = đúng một trang A4 với dữ liệu thật. Nội dung dài (lịch trình nhiều ngày, nhiều
  mục bao gồm) có luật cắt trong spec. Vì vậy chân trang HTML **không** in "Page x of y": CSS chỉ
  đếm trang trong ô lề của `@page`, mà lề đã là 0. Excel giữ số trang (đầu/chân trang của sheet
  có `&P` / `&N` thật).

### 3. Khung chung, khác giọng

- **Đầu trang:** logo (`LOGO_MARK`) và wordmark, dòng liên hệ, loại tài liệu cùng số tài liệu
  (mã đơn hay kỳ báo cáo) và mốc phát hành.
- **Chân trang:** dòng hỗ trợ (tài liệu của khách) hay "Internal — not for distribution" (tài
  liệu nội bộ), cùng giờ in.
- **Giọng khách** (voucher, hoá đơn chờ): ảnh tour, màu thương hiệu, tấm vé có cuống — cùng hình
  tấm vé trên trang chi tiết đơn. **Giọng nội bộ** (báo cáo, Excel): không ảnh, mực đen, teal chỉ
  để nhấn.
- Linh kiện khung đặt ở `@tourism/ui` (thư mục `print-doc`): trang, đầu trang, chân trang, giờ
  in, mộc. Mỗi app truyền logo và chữ của mình.
- **Giờ in** đóng dấu ở client lúc `beforeprint`, theo giờ Việt Nam — không render lúc server
  (lệch hydration, và in ra giờ tải trang thay cho giờ in).

### 4. Dữ liệu

- Voucher in cần lịch trình, mục bao gồm, mục không gồm và điểm hẹn của tour: `BookingTourData`
  thêm `included`. Vẫn chỉ đọc tour ở giai đoạn đang đọc (`needsTourData`: sắp đi, đang đi) —
  voucher đã đi hay đã huỷ in bản rút gọn không lịch trình, không thêm vòng API nào.
- Ảnh bìa là `<img loading="eager">`, không phải `background-image`: ảnh vẫn in khi người in tắt
  "Background graphics", và ảnh trong phần tử đang ẩn không bị trình duyệt hoãn tải. Tour không
  có ảnh thì nền màu `hero` của token.

### 5. Màu là token

Màu mới của bản in vào `@tourism/tokens` (luật 6, không hex trong code):

| Token | Sáng | Dùng cho |
| --- | --- | --- |
| `chart-gain` | `oklch(0.566 0.101 182.5)` | Cột tổng của thác nước, phần "Paid" của thanh trạng thái |
| `chart-cost` | `oklch(0.667 0.155 44.4)` | Cột chi phí, phần huỷ — kèm vân 45° để in trắng đen vẫn tách |
| `pending` | `oklch(0.531 0.117 63.9)` | Mộc và nhãn "Payment pending" |
| `pending-soft` | `oklch(0.967 0.019 80.1)` | Nền dải trạng thái chờ |

Cặp `chart-gain` / `chart-cost` đã qua bộ kiểm bảng màu của skill dataviz (độ sáng, chroma, tách
màu khi mù màu, tương phản) ở chế độ sáng. Teal `chart-1` sẵn có trượt ngưỡng chroma (đọc ra xám)
nên không dùng cho biểu đồ in.

**Giấy luôn sáng** (bổ sung 10/10 khi viết plan Phần 1, trước code): class `dark` trên `<html>`
còn nguyên lúc in, nên khách in từ giao diện tối sẽ ra giấy tối. Bộ build token sinh thêm phạm
vi `.light { … }` — giá trị sáng của mọi màu, đứng sau `.dark` — và tài liệu in mang class
`light`. Bốn token trên có giá trị tối bằng giá trị sáng (cùng lối `on-media`). Ngược lại, đầu
trang nằm trên ảnh bìa dùng scope `dark` sẵn có của repo (như hero trang About): ở đó
`primary-emphasis` là teal nhạt, đúng màu viên sau của logo trên bìa mà không thêm token.

### 6. Không thư viện mới

Không PDF phía server, không trình duyệt headless trên server: giữ quyết định PDF của ADR-0034.
Biểu đồ là SVG tĩnh dựng từ số. Không vướng freeze dependency 15/10.

## Hệ quả

- Hai bộ markup cho cùng dữ liệu. Chấp nhận: chung view-model, test logic ở tầng view-model; tài
  liệu in có test cấu trúc riêng.
- Gỡ khối in cũ của voucher (`globals.css` của web, phần `print` của `voucher-split` /
  `voucher-stack`), khối in của hoá đơn, và các test ghim lớp in (`print:min-h-44`,
  `voucher-split:hidden`…).
- Admin giữ khối `@media print` chung cho các trang khác; `/reports` in tài liệu riêng.
- Safari dưới 18.2 không hỗ trợ trang tên: rơi về `@page` mặc định — có lề, có thể in kèm đầu và
  chân trang của trình duyệt. Chấp nhận.
- Khi người in tắt "Background graphics": ảnh `<img>` vẫn in; lớp phủ, dải màu, mã vạch dựa
  `print-color-adjust: exact` (Chrome, Edge, Firefox từ 97 tôn trọng).

## Phương án đã cân nhắc và bỏ

**Sửa CSS in trên markup màn hình** (cách hiện tại). Không ra được bố cục đã duyệt — cấu trúc
tờ giấy khác hẳn trang web — và mỗi lần sửa màn hình lại vỡ bản in.

**Route in riêng** (`…/print`). Thêm một đường, thêm một cổng đăng nhập (voucher đọc theo phiên),
nút Print phải mở tab mới. Không cho người in thêm gì.

**PDF phía server** (thư viện PDF, hay Chromium headless trên Render). Thêm dependency nặng sát
freeze, và gói free của Render không chạy nổi Chromium.
