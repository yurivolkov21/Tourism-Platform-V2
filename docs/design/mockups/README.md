# Mục lục mockup

Mỗi file ở đây là **ảnh chụp nguyên văn một vòng thiết kế user đã duyệt**. Cùng luật bất biến
với `migration.sql` và entry CHANGELOG cũ: **đừng sửa để lint xanh, đừng xoá vì "đã làm xong"**
(`biome.json` đã loại `*.src.html` khỏi Biome đúng vì lẽ đó).

Lý do giữ, đo 21/09: **20 chỗ trong code đang sống trích dẫn các file này** làm nguồn số đo
("mọi con số dưới đây trích từ đó"), và **6 vòng thiết kế không có spec riêng** — mockup CHÍNH
LÀ bản ghi duy nhất. Cả thư mục chỉ 4 MB.

Xem: mở thẳng file `.src.html` bằng trình duyệt. Bản tự chứa để đăng Artifact thì dựng bằng
`node docs/design/mockups/build.mjs <tên>` (đọc header của `build.mjs` trước — cần build web
xong mới có font).

## Đang dùng — cụm mobile P5b

Năm file này là bản vẽ thành viên đang dựng màn theo. Khung 390×844 đúng dp, có nút đổi nền
sáng/tối và hiện vùng an toàn. Tài liệu bàn giao đi kèm ở `docs/handoff/mobile-*-handoff.md`.

| File | Cụm | Khung | Chốt |
| --- | --- | --- | --- |
| `mobile-auth-screens.src.html` | P5b-1 auth | 17 | 16/09 · đã dựng xong, [bàn giao](../../handoff/mobile-auth-handoff.md) |
| `mobile-browse-screens.src.html` | P5b-2 xem tour | 16 | 18/09 · [bàn giao](../../handoff/mobile-browse-handoff.md) |
| `mobile-booking-screens.src.html` | P5b-3 đặt tour · Trips · bám ngày đi | 25 | 21/09 · [bàn giao](../../handoff/mobile-booking-handoff.md) |
| `mobile-account-screens.src.html` | P5b-4 Saved · tài khoản · bài viết | 14 | 21/09 · [bàn giao](../../handoff/mobile-account-handoff.md) |
| `mobile-review-screens.src.html` | P5b-5 đánh giá | 7 | 21/09 · [bàn giao](../../handoff/mobile-review-handoff.md) |

## Ba trang đơn của khách (P7) — My bookings đã dựng, chi tiết đơn và voucher chờ thi công

Duyệt qua wireframe trong chat ngày 05/10; rộng 1280px, tự thu cho vừa cửa sổ. Ảnh tour lấy
thẳng từ Cloudinary nên cần mạng.

| File | Trang | Chốt |
| --- | --- | --- |
| `booking-detail.src.html` | `/account/bookings/[code]`: vé boarding pass, thanh hành trình, hai cột theo giai đoạn | 05/10 · [spec](../../specs/2026-10-05-booking-pages-redesign-design.md) §5 |
| `booking-voucher.src.html` | `/checkout/success`: thẻ chia đôi mảng teal, mảng trái ảnh tour lớn | 05/10 · spec §6 |
| `booking-list.src.html` | `/account/bookings`: hàng tìm và lọc, phân trang Newer / Older trips | 05/10 · spec §7 · **đã dựng 06/10** (P7 Phần A); nhãn phân trang đổi sang "Previous / Next", bản ghi giữ chữ cũ |

## Đã dựng xong — bản ghi thiết kế web và admin

Cột cuối trả lời câu "xoá file này thì mất gì".

| Vòng thiết kế | File | Xong | Bản ghi nằm ở đâu |
| --- | --- | --- | --- |
| Trang chi tiết tour 5 tab | `tour-detail.src.html` · `tour-detail-departures.src.html` | 13/08 | [spec](../../specs/2026-08-13-tour-detail-redesign.md) chép số đo · code trích: `tours/[slug]/page.tsx`, `tour-media-panel.tsx`, `lib/lightbox.ts` |
| `/contact` gộp về một card | `contact-reui-2` · `contact-reui-5` · `contact-split-panel` | 17/08 | **KHÔNG có spec — ba file này là bản ghi** · code trích: `contact-split.tsx` |
| `/blog` filter sidebar hai trục | `filter-sidebar-1` (chép 1:1 ReUI) · `blog-filter-sidebar` | 17/08 | **KHÔNG có spec — hai file này là bản ghi** · code trích: `blog-filter-sidebar.tsx` |
| Thẻ tour `/tours` thành lưới hai cột | `product-grid-1` · `product-card-5` (chép 1:1 ReUI) · `tours-card-grid` | 17/08 | **KHÔNG có spec — ba file này là bản ghi** · code trích: `tour-list-card.tsx`, spec test của nó, `(listing)/loading.tsx` |
| Wizard checkout 4 bước | `checkout-step1-dates` … `checkout-step4-pay` | 19/08 | **KHÔNG có spec — bốn file này là bản ghi** · [plan](../../plans/2026-08-19-checkout-wizard.md) · code trích: `booking-wizard.tsx`, `wizard-stepper.tsx` |
| Trang receipt hợp nhất với tấm vé | `receipt-1-reference` (bản sao ReUI) · `receipt-booking` · `receipt-ticket` | 19/08 | **KHÔNG có spec — ba file này là bản ghi** · [plan](../../plans/2026-08-19-receipt-success.md) · code trích: `booking-receipt.tsx` |
| Trang login admin (ReUI auth-8, vòng 2) | `admin-login/` (4 ảnh + 2 dump DOM) | 20/08 | **KHÔNG có spec** · code trích: `admin/app/login/page.tsx` |
| Khu account web | `account-area.src.html` | 07/08 | [spec](../../specs/2026-08-08-account-redesign-design.md) |
| Luồng đặt tour bản đầu | `booking-flow.src.html` | 04/08 | [spec](../../specs/2026-08-07-booking-checkout-design.md) · cũng là **mockup mặc định của `build.mjs`** |
| Polish UI admin sau P4c | `outbox-type-menu` · `details-drawer` · `payload-labels` | 04/09 | **KHÔNG có spec — ba file này là bản ghi** · [CHANGELOG 04/09](../../CHANGELOG.md) · code trích: `toolbar-filter-menu.tsx`, `json-drawer.tsx` |
| Chốt cỡ thanh lọc admin 44→36px | `admin-toolbar-sizing.src.html` | 05/09 | [CHANGELOG 05/09](../../CHANGELOG.md) · code trích: 4 file kit toolbar + `bookings-date-range.spec.tsx` |
| Saved và Settings của khách: ba phương án mỗi trang, user chọn Settings C và Saved A | `account-saved-settings.src.html` | 09/10 | [spec](../../specs/2026-10-09-account-saved-settings-redesign-design.md) |

## Công cụ

`build.mjs` — dựng một mockup thành MỘT file HTML tự chứa (font nhúng data-URI) để đăng lên
Artifact. Ra `dist/` (đã gitignore). Mặc định dựng `booking-flow`. Đọc header file đó trước
khi chạy: phải `pnpm --filter @tourism/web build` xong mới có file woff2 để nhúng.
