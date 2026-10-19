# ADR — quyết định kiến trúc

> Mục lục của `adr/`. Bản đồ chung của tài liệu ở [../README.md](../README.md).

ADR trả lời câu hỏi **vì sao** chọn cách làm này. Viết TRƯỚC khi code (luật
CLAUDE.md #5), đánh số tăng dần; số 0007 bỏ trống. Mỗi ADR tự chứa đầy đủ phần
sửa bổ sung (AMEND) của nó; bảng này chỉ để tìm đường. Cột "Lưu ý" ghi ADR bị
thay, cột đã xoá, và số AMEND để biết phải đọc tới cuối file.

| # | Quyết định | Lưu ý |
| --- | --- | --- |
| [0001](0001-tech-stack.md) | Tech stack cho bản rebuild | 3 AMEND (từ AMEND 3, 15/10: freeze dời sang 31/10) |
| [0002](0002-payment-gateway-refund-ledger.md) | `PaymentGateway`, sổ hoàn tiền, atomic claim | |
| [0003](0003-auth-fail-closed.md) | Auth mặc định đóng, mở từng route bằng `@Public()` | |
| [0004](0004-post-visibility-helper.md) | Bài blog hiện ra qua đúng một helper | |
| [0005](0005-media-read-build-url.md) | Đọc ảnh: API dựng URL Cloudinary | |
| [0006](0006-pending-lifecycle.md) | Vòng đời đơn chưa trả tiền: hết hạn, tự huỷ, mở lại được | 2 AMEND |
| [0008](0008-admin-bootstrap-verified.md) | Cấp quyền admin phải qua email đã xác minh | |
| [0009](0009-refund-correctness.md) | Đúng đắn hoàn tiền: khoá, trigger tổng, gate | thước ngày đổi theo [0041](0041-single-cancellation-deadline.md) · 4 AMEND |
| [0010](0010-infra-hardening.md) | Gia cố hạ tầng trước P3b | |
| [0011](0011-p3b-web-architecture.md) | Kiến trúc web: Next.js 16 + `libs/shared/ui` | |
| [0012](0012-typeset-typography.md) | Typography cho nội dung dài | |
| [0013](0013-wuling-theme-tokens.md) | Theme Wuling + tint theo vùng | tint **đã rút** — xem [0015](0015-retire-region-tint.md) |
| [0014](0014-web-component-testing.md) | Test tầng component cho web | 1 AMEND |
| [0015](0015-retire-region-tint.md) | Rút tint theo vùng toàn site | |
| [0016](0016-web-data-layer.md) | Tầng dữ liệu web: oRPC, server-first, ISR + cache-tag | 4 AMEND |
| [0017](0017-web-session-better-auth.md) | Phiên đăng nhập: cookie thẳng trình duyệt ↔ API | 6 AMEND |
| [0018](0018-web-map-library.md) | Bản đồ `/contact`: maplibre-gl + OpenFreeMap | 2 AMEND |
| [0019](0019-color-token-roles.md) | Tách vai token màu: bề mặt · chữ · ranh giới | 4 AMEND 13–14/10 (mực cảnh báo, mực đỏ đạt tương phản ở cả hai theme, mực trạng thái của app mobile) |
| [0020](0020-real-images-sourcing.md) | Ảnh thật: nguồn, ghi công, đường vào catalog | mục 1 đã sửa — lô ảnh đầu bị loại toàn bộ · 1 AMEND |
| [0021](0021-media-write-surface.md) | Khách tải ảnh lên: ký trực tiếp Cloudinary | 3 AMEND |
| [0022](0022-tour-detail-tabs.md) | Trang chi tiết tour chuyển sang 5 tab | |
| [0023](0023-tour-merchandising-fields.md) | Năm cột nội dung bán hàng cho tour | cột `freeCancellationDays` đã xoá theo [0041](0041-single-cancellation-deadline.md) |
| [0024](0024-deploy-targets.md) | Nơi deploy v1: Vercel · Render · Supabase · Resend | 6 AMEND (từ AMEND 6, 14/10: Vercel chỉ tạo deployment cho nhánh `main`) |
| [0025](0025-transactional-email-react-email.md) | Email giao dịch viết bằng react-email, không dùng dashboard | |
| [0026](0026-p4-admin-app.md) | Admin là app riêng, dùng chung phiên qua subdomain | 5 AMEND |
| [0027](0027-admin-surface-palette.md) | Bề mặt riêng cho admin: vỏ tối, ruột trắng lạnh | 1 AMEND |
| [0028](0028-bookings-stats-follow-filter.md) | Thẻ số liệu ăn theo bộ lọc ngày | |
| [0029](0029-cancellation-approve-partial-refund.md) | Duyệt yêu cầu huỷ với mức hoàn theo chính sách | **thay một phần** bởi [0041](0041-single-cancellation-deadline.md) — phần còn hiệu lực ghi ở đầu ADR |
| [0030](0030-refund-policy-tiers.md) | Chính sách hoàn tiền theo bậc | **thay một phần** bởi [0041](0041-single-cancellation-deadline.md) — phần còn hiệu lực ghi ở đầu ADR |
| [0031](0031-review-rejection.md) | Từ chối đánh giá là quyết định chung cuộc | AMEND 28/09: lý do chọn từ danh sách |
| [0032](0032-review-author-edit.md) | Tác giả sửa lại đánh giá bị bác, có trần vòng lặp | 2 AMEND |
| [0033](0033-financial-model.md) | Báo cáo có kết quả kinh doanh, không chỉ dòng tiền | định nghĩa doanh thu sửa ở [0041](0041-single-cancellation-deadline.md) §9 · 3 AMEND (tháng đang chạy chỉ ghi nhận chuyến đã kết thúc) |
| [0034](0034-excel-report-export.md) | Báo cáo tháng xuất Excel; từ AMEND 3 (10/10) danh sách cũng xuất Excel thay CSV | 3 AMEND |
| [0035](0035-media-lifecycle.md) | Ảnh có đường chết, đi qua hàng đợi có độ trễ | 4 AMEND (từ AMEND 4, 19/10: hàng dọn có màn chỉ đọc, handler trả báo cáo; Giới hạn #5 và #6 đóng) |
| [0036](0036-dashboard-daily-series.md) | Dashboard nối số thật bằng một chuỗi theo ngày | 2 AMEND |
| [0037](0037-default-write-throttle.md) | Mọi route ghi sinh ra đã có trần | 3 AMEND |
| [0038](0038-web-shell-security-headers.md) | Security header + CSP cho web và admin | 5 AMEND |
| [0039](0039-inbound-channels-outbound-email.md) | Kênh vào và email đi ra: ack, consent, suppression | 1 AMEND |
| [0040](0040-mobile-app-expo.md) | App mobile Expo trong monorepo | 7 AMEND |
| [0041](0041-single-cancellation-deadline.md) | **Một hạn chót mỗi chuyến** — luật hoàn tiền hiện hành | thay 0029, 0030 · 2 AMEND (chuyến bị công ty huỷ thì khách hết tự huỷ; khách đọc lý do huỷ chuyến) |
| [0042](0042-shared-client-rules-core.md) | `@tourism/core`: luật dùng chung cho mọi client | |
| [0043](0043-refund-payment-event.md) | Hoàn tiền để lại vết ở sổ `payment_events` | |
| [0044](0044-prerender-retry-transient-api.md) | Prerender thử lại khi API hắt hơi | 1 AMEND |
| [0045](0045-region-vocabulary-in-contract.md) | Ba vùng miền là từ vựng chung, sống ở contract | |
| [0046](0046-departure-phase-derived.md) | Giai đoạn chuyến suy từ ngày; `status` chỉ là công tắc bán hàng | 1 AMEND |
| [0047](0047-tour-editor-sections.md) | Sửa tour theo từng khối: thay nguyên danh sách, khoá phiên bản, cổng đăng tour | |
| [0048](0048-tour-photos.md) | Ảnh tour: một danh sách có thứ tự, kho địa danh làm thư viện, chỉ ảnh tự tải lên mới được dọn | 2 AMEND |
| [0049](0049-tour-workspace-steps.md) | Khu sửa tour thành thanh bước: form một bên, cột phải một bên, bước cuối Review & publish | 1 AMEND |
| [0050](0050-ai-concierge-chat.md) | Trợ lý AI: chat trong API, lịch sử ở server, tool ghi phải được khách duyệt, trần chi phí theo token | 1 AMEND (15/10: tên API AI SDK 7, cột giữ lượt) |
| [0051](0051-posts-admin.md) | Quản trị bài viết: markdown kèm xem trước, slug đặt một lần, đủ mới được đăng, trang bài viết mang tag `tours` | |
| [0052](0052-admin-staff-tier.md) | Nhân sự admin hai bậc: Owner từ `ADMIN_EMAILS`, Staff do Owner cấp; bảng quyền ở contract; khoá tài khoản chặn tạo phiên | 1 AMEND |
| [0053](0053-delete-unused-categories-destinations.md) | Xoá danh mục và điểm đến khi chưa tour nào dùng | 2 AMEND (từ AMEND 2, 15/10: khoá ngoại điểm đến của tour đổi sang `RESTRICT`) |
| [0054](0054-customer-bookings-list-phase-filters.md) | Đơn của khách: một luật giai đoạn dùng chung; `bookings.mine` lọc, tìm, xếp theo hành trình và phân trang ở server | 1 AMEND |
| [0055](0055-mobile-data-layer.md) | Tầng dữ liệu mobile: oRPC `OpenAPILink` + TanStack Query, client-first | 2 AMEND |
| [0056](0056-mobile-google-native-signin.md) | Đăng nhập Google trên app bằng SDK gốc và ID token; đóng proxy Expo | 1 AMEND (thi công 13/10) |
| [0057](0057-print-documents.md) | Bản in là tài liệu riêng: component chỉ-in, trang in `doc` A4 lề 0, khung đầu và chân trang chung | |
| [0058](0058-tour-card-next-departure-badges-rating-sort.md) | Thẻ tour mang đợt kế tiếp đặt được và badge; sắp theo rating; bộ lọc giá, thời lượng, độ khó ở lại web | |
| [0059](0059-site-slot-appearance.md) | Appearance: danh mục khe ở contract, bốn nguồn ảnh của một lần lưu, bảng ảnh gốc trong code API | |
| [0060](0060-media-library.md) | Media library: một ảnh là một publicId, sửa ghi công một lần cho mọi chỗ dùng, hàng dọn chỉ đọc, ảnh điểm đến có trình sửa riêng | |

## Thêm ADR mới

Đặt tên `NNNN-ten-tieng-anh.md` với số kế tiếp, mở đầu bằng khối Trạng thái ·
Bối cảnh · Liên quan như các ADR có sẵn, rồi thêm một dòng vào bảng trên.
