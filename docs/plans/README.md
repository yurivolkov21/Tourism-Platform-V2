# Plans — làm theo bước nào

> Mục lục của `plans/`. Bản đồ chung của tài liệu ở [../README.md](../README.md).

Kế hoạch thi công viết sau khi spec được duyệt. **Tất cả đã đóng, trừ hai**: plan
một hạn chót còn Bước 8 và prompt các phase còn lại còn dùng cho P6. Đầu mỗi file
có một dòng trạng thái trỏ tới entry CHANGELOG ghi kết quả thật. Prompt giao cho
session thi công nằm riêng ở [`prompts/`](prompts/).

Plan lớn (có file trên 700 KB) là bản ghi thi công từng bước kèm code mẫu, không
phải tài liệu để đọc từ đầu đến cuối. Muốn biết một đợt đã làm gì, đọc entry
CHANGELOG của nó trước.

**P3a backend**
[nền + reviews](2026-07-19-p3a-a-foundation-reviews.md) ·
[wishlist · enquiry · newsletter](2026-07-19-p3a-b-wishlist-enquiry-newsletter.md) ·
[posts · site-media](2026-07-21-p3a-c-posts-site-media.md) ·
[đóng contract](2026-07-21-p3a-contract-closeout.md) ·
[admin bootstrap](2026-07-21-admin-bootstrap-verified.md) ·
[đúng đắn refund](2026-07-21-refund-correctness.md) ·
[vòng đời PENDING](2026-07-22-pending-lifecycle.md)

**P3b web tĩnh**
[typeset](2026-07-22-ui-typeset.md) ·
[theme Wuling](2026-07-22-wuling-theme-tokens.md) ·
[Home](2026-07-23-home-page.md) ·
[Auth](2026-07-24-auth-pages.md) ·
[Blog](2026-07-25-blog-pages.md) ·
[pháp lý/utility](2026-07-25-legal-utility-pages.md) ·
[Tours](2026-07-27-tours-pages.md) ·
[Destinations](2026-07-28-destinations-pages.md)

**Nối API và khu account**
[Blog](2026-07-31-blog-api.md) ·
[Destinations](2026-07-31-destinations-api.md) ·
[catalogue](2026-07-31-tours-catalogue-api.md) ·
[Contact + Newsletter](2026-08-03-contact-newsletter-api.md) ·
[Auth + phiên](2026-08-03-auth-pages-api.md) ·
[revalidation](2026-08-03-on-demand-revalidation.md) ·
[khu Account](2026-08-04-account-area.md) ·
[PayPal](2026-08-04-paypal-capture-smoke.md) ·
[bản đồ /contact](2026-08-06-contact-map-offices.md) ·
[media ghi (ADR-0021)](2026-08-12-media-write-surface.md)

**Thiết kế lại và P4**
[account](2026-08-10-account-redesign.md) ·
[checkout + account](2026-08-10-checkout-account-redesign.md) ·
[account "Hộ chiếu"](2026-08-11-account-passport.md) ·
[tour detail](2026-08-13-tour-detail-redesign.md) ·
[wizard checkout](2026-08-19-checkout-wizard.md) ·
[receipt success](2026-08-19-receipt-success.md) ·
[export theo lựa chọn](2026-09-01-bookings-export-selection.md) ·
[thẻ số liệu theo bộ lọc](2026-09-04-bookings-stats-follow-filter.md) ·
[mô hình tài chính + Excel](2026-09-05-financial-model-excel-report.md)

**Mobile, seed, hoàn tiền**
[prompt P5a](prompts/2026-09-08-p5a-prompt-thi-cong.md) ·
[prompt các phase còn lại](prompts/2026-09-08-prompts-cac-phase-con-lai.md) (chỉ còn P6) ·
[seed trọn năm 2026](2026-09-14-seed-khung-2026.md) ·
[**một hạn chót**](2026-09-15-refund-deadline.md) (còn Bước 8, lượt seed ~03/11) ·
[P5b-1 auth mobile](2026-09-16-p5b-auth-wireframe.md) ·
[P5b-2 T0 tầng dữ liệu mobile browse](2026-09-23-mobile-browse-t0-data-layer.md) ·
[P5b-4 spec cụm tài khoản mobile](2026-09-25-mobile-account-screens.md) ·
[P5b-4 return-to sau đăng nhập và AuthGateScreen](2026-09-25-mobile-account-return-to-auth.md)

**P4e–P4f admin** (plan F16 trở đi kèm prompt thi công ở cuối file)
[P4e-1 chuyến khởi hành](2026-09-21-p4e-1-departures.md) ·
[prompt ba session P4e-1](prompts/2026-09-21-p4e-1-prompts.md) ·
[P4e-2 danh mục + điểm đến](2026-09-22-p4e-2-categories-destinations.md) ·
[F16 giai đoạn chuyến](2026-09-23-departure-phase.md) ·
[F17 tạo và sửa tour (P4e-3a)](2026-09-24-p4e-3a-tour-editor.md) ·
[F18 ảnh tour (P4e-3b)](2026-09-28-p4e-3b-tour-photos.md) ·
[F19 khu sửa tour dạng thanh bước (P4e-3c)](2026-09-28-p4e-3c-tour-workspace-steps.md) ·
[P4e-4 quản trị bài viết](2026-10-02-p4e-4-posts-admin.md) ·
[sửa sạn giao diện admin](2026-10-05-admin-ui-polish.md) ·
[P4f vùng Users: Owner và Staff](2026-10-02-p4f-users-staff.md) ·
[P4f Appearance: ảnh các khe của web](2026-10-19-p4f-appearance.md) ·
[P4f Media library](2026-10-19-p4f-media.md) ·
[Nhật ký thao tác admin](2026-10-19-admin-activity-log.md)

**P7, bản in và hoá đơn chờ**
[P7 ba trang đơn của khách (A, B, C)](2026-10-05-booking-pages-redesign.md) ·
[prompt thi công P7](prompts/2026-10-05-booking-pages-redesign-prompts.md) ·
[Saved và Settings của khách](2026-10-09-account-saved-settings.md) ·
[G40 Phần 1: bản in voucher và hoá đơn chờ](2026-10-10-g40-part1-web-print.md) ·
[prompt thi công G40 Phần 1](prompts/2026-10-10-g40-part1-web-print-prompt.md) ·
[G40 Phần 2: bản in báo cáo tháng C2](2026-10-12-g40-part2-report-print.md) ·
[G40 Phần 3: Excel báo cáo D1 và danh sách xuất Excel](2026-10-10-g40-part3-admin-excel.md) ·
[prompt thi công G40 Phần 3](prompts/2026-10-10-g40-part3-admin-excel-prompt.md) ·
[G42 màn hoá đơn chờ](2026-10-13-g42-pending-receipt.md)

**P6 trợ lý AI**
[P6 trợ lý AI tư vấn tour](2026-10-15-p6-ai-concierge.md)

**Công cụ máy dev (ngoài repo, chưa rõ trạng thái)**
[mod `tourism-status` (kèm prompt thi công)](2026-10-02-tourism-status-mod.md)
