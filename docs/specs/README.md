# Specs — sẽ xây gì

> Mục lục của `specs/`. Bản đồ chung của tài liệu ở [../README.md](../README.md).

Spec trả lời câu hỏi **sẽ xây gì** ở một đợt: viết đầu đợt, user duyệt rồi mới
code. Mỗi spec đi kèm một plan cùng tên ở [`plans/`](../plans/README.md), trừ vài
đợt gộp. Spec sinh từ skill `superpowers:brainstorming` cũng ghi vào đây.

**Nền móng (P1–P3a)**
[P1 API lõi](2026-07-18-p1-api-core.md) ·
[P2 money-path](2026-07-18-p2-money-path.md) ·
[P3a API khách](2026-07-19-p3a-customer-api.md) ·
[P3a đóng contract](2026-07-21-p3a-contract-closeout-design.md)

**Web tĩnh (P3b)**
[typeset](2026-07-22-ui-typeset-design.md) ·
[theme Wuling](2026-07-22-wuling-theme-tokens-design.md) ·
[Home](2026-07-23-home-page-design.md) ·
[Auth](2026-07-24-auth-pages-design.md) ·
[Blog](2026-07-25-blog-pages-design.md) ·
[pháp lý/utility](2026-07-25-legal-utility-pages-design.md) ·
[Tours](2026-07-27-tours-pages-design.md) ·
[Destinations](2026-07-28-destinations-pages-design.md)

**Nối web vào API**
[Blog + nền `lib/api`](2026-07-31-blog-api-design.md) ·
[Destinations](2026-07-31-destinations-api-design.md) ·
[catalogue thật](2026-07-31-tours-catalogue-api-design.md) ·
[Contact + Newsletter](2026-08-03-contact-newsletter-api-design.md) ·
[Auth + phiên](2026-08-03-auth-pages-api-design.md) ·
[on-demand revalidation](2026-08-03-on-demand-revalidation-design.md) ·
[khu Account](2026-08-04-account-area-design.md) ·
[PayPal capture + smoke](2026-08-04-paypal-capture-smoke-design.md) ·
[bản đồ /contact](2026-08-06-contact-map-offices-design.md) ·
[booking + checkout](2026-08-07-booking-checkout-design.md)

**Các vòng thiết kế lại**
[khu account](2026-08-08-account-redesign-design.md) ·
[checkout + account](2026-08-10-checkout-account-redesign.md) ·
[account "Hộ chiếu"](2026-08-11-account-passport-redesign.md) ·
[tour detail](2026-08-13-tour-detail-redesign.md)

**Deploy và admin (P4)**
[deploy v1](2026-08-19-deploy-v1-design.md) ·
[P4a scaffold](2026-08-20-p4a-admin-scaffold-design.md) ·
[P4b kit + 3 vùng](2026-08-31-p4b-admin-ready-areas-design.md) ·
[export theo lựa chọn](2026-09-01-bookings-export-selection-design.md) ·
[P4c vận hành](2026-09-02-p4c-operations-design.md)

**Bảo mật và hạ tầng (W3–W4)**
[W3 vỏ Next + CSP](2026-09-07-w3-web-shell-headers-design.md) ·
[W4 kênh vào + email](2026-09-07-w4-inbound-channels-design.md)

**Mobile, dữ liệu và hoàn tiền (P5)**
[P5a template](2026-09-08-p5a-mobile-template-design.md) ·
[lịch vận hành 2026](2026-09-10-seed-lich-van-hanh-2026-design.md) ·
[seed trọn năm 2026](2026-09-14-seed-khung-2026-design.md) ·
[**một hạn chót**](2026-09-15-refund-deadline-design.md) ·
[P5b-1 auth mobile](2026-09-16-p5b-auth-wireframe-design.md) ·
[**đăng nhập Google native, xong 13/10**](2026-10-09-mobile-google-native-signin-design.md)

**Admin catalog (P4e, xong 05/10)**
[**P4e-1 chuyến + trạng thái đăng**](2026-09-21-p4e-1-departures-design.md) ·
[**P4e-2 danh mục + điểm đến**](2026-09-22-p4e-2-categories-destinations-design.md) ·
[**F16 giai đoạn chuyến**](2026-09-23-departure-phase-design.md) ·
[**F17 tạo và sửa tour (P4e-3a)**](2026-09-24-p4e-3a-tour-editor-design.md) ·
[**F18 ảnh tour (P4e-3b)**](2026-09-28-p4e-3b-tour-photos-design.md) ·
[**F19 khu sửa tour dạng thanh bước (P4e-3c)**](2026-09-28-p4e-3c-tour-workspace-steps-design.md) ·
[**P4e-4 quản trị bài viết**](2026-10-02-p4e-4-posts-admin-design.md)

**Sửa sạn giao diện admin (trước freeze)**
[**ô chọn chung, Quick Create, xoá danh mục và điểm đến, sạn nhỏ**](2026-10-05-admin-ui-polish-design.md)

**Admin người dùng và media (P4f: Users xong 13/10; Appearance xong 19/10; Media library viết 16/10, Yuri duyệt 19/10, xong cả hai phần 19/10)**
[**P4f vùng Users: Owner và Staff**](2026-10-02-p4f-users-staff-design.md) ·
[P4f Appearance: ảnh các khe của web](2026-10-15-p4f-appearance-design.md) ·
[P4f Media library: một chỗ xem và sửa mọi ảnh](2026-10-16-p4f-media-library-design.md)

**Nhật ký thao tác admin (sau P4f; Yuri chọn làm 19/10, xong 19/10)**
[Nhật ký thao tác admin và trang Activity](2026-10-19-admin-activity-log-design.md)

**Trợ lý AI (P6, chưa thi công)**
[P6 trợ lý tư vấn tour](2026-09-29-p6-ai-concierge-design.md)

**Trang đơn của khách (P7: Phần A My bookings xong 06/10; B chi tiết đơn và C voucher xong 09/10)**
[Thiết kế lại chi tiết đơn, voucher, My bookings](2026-10-05-booking-pages-redesign-design.md)

**Trang account Saved và Settings (chỉ đổi giao diện, xong 09/10)**
[Thiết kế lại Saved và Settings](2026-10-09-account-saved-settings-redesign-design.md)

**Bản in và file xuất (G40, duyệt thiết kế 10/10, ba phần thi công xong 12/10)**
[Thiết kế lại bản in voucher, hoá đơn chờ, báo cáo tháng; Excel báo cáo và danh sách](2026-10-10-print-and-export-redesign-design.md)

**Màn hoá đơn chờ cho đơn chưa trả (G42, phương án A, xong 13/10)**
[Thẻ chờ cùng khung voucher ở `/checkout/cancel` và `/checkout/success`](2026-10-13-g42-pending-receipt-design.md)

**Việc tồn đọng của admin (G43 ở `/subscribers`, xong 13/10)**
[Chọn hàng và lọc ngày đăng ký ở `/subscribers`](2026-10-13-g43-subscribers-selection-dates.md)

**Việc tồn đọng của admin (G45 ở `/bookings`, xong 14/10)**
[Lọc `/bookings` theo một tài khoản](2026-10-13-g45-bookings-account-filter.md)

**Thông báo trong app mobile (25/10)**
[Danh sách thông báo suy ra ở máy, chuông ở Home](2026-10-25-in-app-notifications-design.md)

**Công cụ máy dev (ngoài repo)**
[mod `tourism-status`: dải trạng thái, canh CI, docs-freshness](2026-10-02-tourism-status-mod-design.md)
