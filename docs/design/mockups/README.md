# Mục lục mockup

Mỗi file ở đây là bản chụp nguyên văn của một vòng thiết kế đã được chủ dự án
duyệt. Mockup là bản ghi bất biến, cùng luật với `migration.sql` và entry CHANGELOG
cũ: đừng sửa để lint xanh, đừng xoá vì tính năng đã làm xong. Vì lý do đó,
`biome.json` loại các file `*.src.html` khỏi Biome.

Có hai lý do giữ cả thư mục. Khoảng 20 chỗ trong code trích các file này làm nguồn
số đo. Và 6 vòng thiết kế không có spec riêng, nên mockup là bản ghi duy nhất của
chúng. Cả thư mục chỉ khoảng 4 MB.

Cách xem: mở thẳng file `.src.html` bằng trình duyệt. Muốn có một file HTML tự chứa
(nhúng sẵn font) thì chạy `node docs/design/mockups/build.mjs <tên>`; đọc phần đầu
của `build.mjs` trước, vì cần build web xong mới có file font để nhúng.

## Năm cụm màn của app điện thoại

Người dựng màn làm theo năm bản vẽ này; cả năm cụm vào nhánh chính từ 09/10 tới
12/10/2026. Khung 390×844 đúng đơn vị dp, có nút đổi nền sáng và tối, có hiện vùng
an toàn. Tài liệu bàn giao đi kèm nằm ở [handoff/](../../handoff/README.md).

| File | Cụm màn | Số khung | Duyệt |
| --- | --- | --- | --- |
| `mobile-auth-screens.src.html` | Đăng nhập (P5b-1) | 17 | 16/09, [bàn giao](../../handoff/mobile-auth-handoff.md) |
| `mobile-browse-screens.src.html` | Xem tour (P5b-2) | 16 | 18/09, [bàn giao](../../handoff/mobile-browse-handoff.md) |
| `mobile-booking-screens.src.html` | Đặt tour, danh sách chuyến (Trips), theo dõi ngày đi (P5b-3) | 25 | 21/09, [bàn giao](../../handoff/mobile-booking-handoff.md) |
| `mobile-account-screens.src.html` | Tour đã lưu, tài khoản, bài viết (P5b-4) | 14 | 21/09, [bàn giao](../../handoff/mobile-account-handoff.md) |
| `mobile-review-screens.src.html` | Đánh giá (P5b-5) | 7 | 21/09, [bàn giao](../../handoff/mobile-review-handoff.md) |

## Giao diện app theo Material 3

Bản vẽ qua bốn vòng và được duyệt ngày 19/10/2026. Vòng 1 dựng ngày 14/10. Vòng 2
sửa theo phạm vi chủ dự án chốt. Vòng 3 đổi sang ngôn ngữ app gốc vì vòng 2 còn
giống web co giãn. Vòng 4 vẽ lại theo Material 3 Expressive vì buổi demo chạy
Android là chính.

Vòng 4 có: thanh điều hướng đáy tràn ngang với viên chỉ báo, thanh trên có mũi tên
lùi và tiêu đề canh trái, chữ Roboto theo thang chữ Material 3, icon Material
Symbols, ô nhập viền ngoài, chip lọc bo góc 8, nút phân đoạn cho Trips, thanh tìm
cao 56, bottom sheet tràn ngang, và danh sách dạng thẻ rời như phần Cài đặt của
Android 16. Trang Home giữ bố cục cũ với dải ba vùng miền xếp dọc. Khung 390×844,
có nút đổi nền sáng và tối; cuối trang có bảng việc code xếp theo ưu tiên P1 và
P2. Font tải từ Google Fonts nên cần mạng.

| File | Phạm vi | Số khung | Duyệt |
| --- | --- | --- | --- |
| `mobile-ui-upgrade.src.html` | Toàn bộ màn của app khách. Nhãn "Đổi bố cục" đánh dấu màn có bố cục khác code hiện tại; nhãn "Để sau" đánh dấu màn đã vẽ lại nhưng nằm ngoài đợt code 23–30/10 | 42 | 19/10, [bàn giao](../../handoff/mobile-ui-upgrade-handoff.md) |

## Ba trang đơn của khách

Duyệt qua bản phác trong buổi trao đổi ngày 05/10/2026, dựng xong ngày 06/10 và
09/10. Rộng 1280px, tự thu cho vừa cửa sổ. Ảnh tour lấy thẳng từ Cloudinary nên cần
mạng.

| File | Trang | Ghi chú |
| --- | --- | --- |
| `booking-detail.src.html` | `/account/bookings/[code]`: vé kiểu thẻ lên máy bay, thanh hành trình, hai cột theo giai đoạn của đơn | [Spec](../../specs/2026-10-05-booking-pages-redesign-design.md) §5 |
| `booking-voucher.src.html` | `/checkout/success`: thẻ chia đôi, mảng teal bên phải, ảnh tour lớn bên trái | Spec §6 |
| `booking-list.src.html` | `/account/bookings`: hàng tìm và lọc, phân trang | Spec §7. Nhãn phân trang trong code đã đổi thành "Previous / Next"; bản vẽ giữ chữ cũ "Newer / Older trips" |

## Bản in và file xuất

Duyệt bằng mắt ngày 10/10/2026, dựng xong ngày 12/10. Mỗi trang là một tờ A4 thật
(210 × 297 mm), có ô thu phóng, chế độ xem như in trắng đen và nút in thử từng
phương án. Ảnh tour lấy từ Cloudinary nên cần mạng; số liệu báo cáo chỉ để minh hoạ.

| File | Đầu ra | Phương án được chọn |
| --- | --- | --- |
| `print-voucher.src.html` | Voucher in ở `/checkout/success`: phương án 1–4, 5a (ghép nguyên văn, tràn khổ) và 5b | 5b, [spec](../../specs/2026-10-10-print-and-export-redesign-design.md) §3 |
| `print-receipt.src.html` | Hoá đơn của đơn chờ trả tiền: B1 (vé ở trạng thái chờ), B2 (hoá đơn thuần) | B1, spec §4 |
| `print-report.src.html` | Báo cáo tháng in ở `/reports`: C1 (kiểu sổ sách), C2 (kiểu dashboard, biểu đồ thác nước) | C2, spec §5 |
| `excel-report-d1.xlsx` | File Excel báo cáo tháng, phương án D1. Mở bằng Excel; sheet Detail là 71 đơn thật tạo trong tháng 9 | Spec §6 |

## Màn hoá đơn của đơn chờ trả tiền

Duyệt ngày 13/10/2026 giữa hai hướng: A (voucher ở trạng thái chờ, bốn tab) và B
(bản in B1 đưa lên màn hình, hai tab); hướng A được chọn. Rộng 1280px tự thu cho vừa
khung, kèm một bản rộng 390px. Ảnh là ảnh mẫu trong repo
(`apps/web/public/mock/hoian.jpg`), không cần mạng ngoài phần font.

| File | Trang | Ghi chú |
| --- | --- | --- |
| `pending-receipt.src.html` | `/checkout/cancel` và `/checkout/success` khi đơn chưa trả: thẻ chia đôi như voucher, cột phải màu xám, nút Pay now | Hướng A, [spec](../../specs/2026-10-13-g42-pending-receipt-design.md) |

## Bản ghi thiết kế của web và admin đã dựng xong

Cột cuối trả lời câu hỏi "xoá file này thì mất gì".

| Vòng thiết kế | File | Xong | Bản ghi nằm ở đâu |
| --- | --- | --- | --- |
| Trang chi tiết tour 5 tab | `tour-detail.src.html`, `tour-detail-departures.src.html` | 13/08 | [Spec](../../specs/2026-08-13-tour-detail-redesign.md) chép số đo. Code trích: `tours/[slug]/page.tsx`, `tour-media-panel.tsx`, `lib/lightbox.ts` |
| `/contact` gộp về một thẻ | `contact-reui-2`, `contact-reui-5`, `contact-split-panel` | 17/08 | Không có spec, ba file này là bản ghi. Code trích: `contact-split.tsx` |
| Thanh lọc hai trục bên cạnh `/blog` | `filter-sidebar-1` (chép nguyên từ ReUI), `blog-filter-sidebar` | 17/08 | Không có spec, hai file này là bản ghi. Code trích: `blog-filter-sidebar.tsx` |
| Thẻ tour ở `/tours` thành lưới hai cột | `product-grid-1`, `product-card-5` (chép nguyên từ ReUI), `tours-card-grid` | 17/08 | Không có spec, ba file này là bản ghi. Code trích: `tour-list-card.tsx`, test của nó, `(listing)/loading.tsx` |
| Đặt tour bốn bước | `checkout-step1-dates` tới `checkout-step4-pay` | 19/08 | Không có spec, bốn file này là bản ghi; [plan](https://github.com/yurivolkov21/Tourism-Platform-V2/blob/6785326e69949d4ef566c5eaf7c3eaa3706859c8/docs/plans/2026-08-19-checkout-wizard.md) xem trong lịch sử git. Code trích: `booking-wizard.tsx`, `wizard-stepper.tsx` |
| Trang kết quả thanh toán gộp với tấm vé | `receipt-1-reference` (bản sao ReUI), `receipt-booking`, `receipt-ticket` | 19/08 | Không có spec, ba file này là bản ghi; [plan](https://github.com/yurivolkov21/Tourism-Platform-V2/blob/6785326e69949d4ef566c5eaf7c3eaa3706859c8/docs/plans/2026-08-19-receipt-success.md) xem trong lịch sử git. Code từng trích là `booking-receipt.tsx`, đã thay bằng `pending-card.tsx` ngày 13/10 |
| Trang đăng nhập admin (mẫu auth-8 của ReUI, vòng 2) | `admin-login/` (4 ảnh và 2 bản chép DOM) | 20/08 | Không có spec. Code trích: `admin/app/login/page.tsx` |
| Khu tài khoản trên web | `account-area.src.html` | 07/08 | [Spec](../../specs/2026-08-08-account-redesign-design.md) |
| Luồng đặt tour bản đầu | `booking-flow.src.html` | 04/08 | [Spec](../../specs/2026-08-07-booking-checkout-design.md). Đây cũng là mockup mặc định của `build.mjs` |
| Chỉnh giao diện admin sau đợt trang vận hành | `outbox-type-menu`, `details-drawer`, `payload-labels` | 04/09 | Không có spec, ba file này là bản ghi; xem [CHANGELOG 04/09](../../changelog/2026-09-admin-ui-and-filters.md). Code trích: `toolbar-filter-menu.tsx`, `json-drawer.tsx` |
| Chốt cỡ thanh lọc admin từ 44 xuống 36px | `admin-toolbar-sizing.src.html` | 05/09 | [CHANGELOG 05/09](../../changelog/2026-09-refund-policy-and-reviews.md). Code trích: 4 file trong kit thanh công cụ và `bookings-date-range.spec.tsx` |
| Tour đã lưu và Cài đặt của khách: ba phương án mỗi trang; chọn Cài đặt C và Đã lưu A | `account-saved-settings.src.html` | 09/10 | [Spec](../../specs/2026-10-09-account-saved-settings-redesign-design.md) |

## Công cụ

`build.mjs` dựng một mockup thành một file HTML tự chứa, nhúng font dạng data URI,
để đăng lên trang chia sẻ. File ra nằm ở `dist/` (đã gitignore); mặc định dựng
`booking-flow`. Đọc phần đầu của file trước khi chạy: phải chạy
`pnpm --filter @tourism/web build` xong mới có file woff2 để nhúng.
