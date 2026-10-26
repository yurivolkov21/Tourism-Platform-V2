# Quyết định kiến trúc (ADR)

Thư mục này ghi các quyết định kiến trúc của dự án, mỗi file một quyết định. Đọc
ở đây khi muốn biết vì sao hệ thống được làm theo cách hiện tại, phương án nào đã
bị loại và cái giá phải trả. Bản đồ chung của tài liệu ở [../README.md](../README.md).

## Cách đọc một ADR

- Mỗi ADR mở đầu bằng trạng thái, bối cảnh và các liên kết liên quan, rồi tới
  phần quyết định và hệ quả.
- Khi một quyết định đã chốt cần đổi, dự án không sửa thân ADR mà thêm một phần
  bổ sung (AMEND) ở cuối file, ghi ngày và lý do. Muốn biết luật đang áp dụng thì
  đọc tới hết file.
- Một ADR có thể bị ADR sau thay toàn bộ hoặc một phần. Cột "Ghi chú" trong các
  bảng dưới nói rõ chỗ đó và số lần bổ sung.
- Số đánh tăng dần theo thời gian; số 0007 bỏ trống.
- ADR là bản ghi viết trong lúc làm nên có dùng mã nội bộ như P4e hay W2. Nghĩa
  của các mã ấy tra ở [thuật ngữ](../glossary.md#mã-nội-bộ-trong-tài-liệu).

## Nền tảng, bảo mật và triển khai

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0001](0001-tech-stack.md) | Bộ công nghệ (*tech stack*) cho bản viết lại | 3 lần bổ sung; lần 3 (15/10/2026) dời mốc ngừng nâng cấp thư viện (*freeze*) sang 31/10/2026 |
| [0003](0003-auth-fail-closed.md) | Xác thực mặc định đóng: mọi route cần đăng nhập, route công khai phải đánh dấu `@Public()` | |
| [0008](0008-admin-bootstrap-verified.md) | Chỉ cấp quyền quản trị cho email đã xác minh | |
| [0010](0010-infra-hardening.md) | Gia cố hạ tầng API trước khi làm web: bộ bắt lỗi chung, header bảo mật, Sentry | 1 lần bổ sung (19/10/2026: nối Sentry thật cho API) |
| [0017](0017-web-session-better-auth.md) | Phiên đăng nhập trên web: cookie đi thẳng giữa trình duyệt và API (Better Auth) | 7 lần bổ sung |
| [0024](0024-deploy-targets.md) | Nơi triển khai: Vercel cho web, Render cho API, Supabase cho cơ sở dữ liệu, Resend cho email | 6 lần bổ sung; lần 6 (14/10/2026): Vercel chỉ dựng bản triển khai cho nhánh `main` |
| [0037](0037-default-write-throttle.md) | Mọi route ghi dữ liệu mặc định có trần số lần gọi (*rate limit*) | 4 lần bổ sung; lần 4 (26/10/2026): `TRUST_PROXY` trên Render tin dải địa chỉ của Cloudflare |
| [0038](0038-web-shell-security-headers.md) | Header bảo mật và CSP cho web khách và web quản trị | 5 lần bổ sung |
| [0042](0042-shared-client-rules-core.md) | Thư viện `@tourism/core`: luật nghiệp vụ dùng chung cho mọi client (web, quản trị, mobile) | |

## Đặt tour, thanh toán và hoàn tiền

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0002](0002-payment-gateway-refund-ledger.md) | Cổng thanh toán qua interface `PaymentGateway`, sổ hoàn tiền, và cách giành quyền xử lý một đơn an toàn (*atomic claim*) | |
| [0006](0006-pending-lifecycle.md) | Vòng đời đơn chưa trả tiền: hết hạn, tự huỷ, mở lại trang thanh toán được | 2 lần bổ sung |
| [0009](0009-refund-correctness.md) | Hoàn tiền đúng: khoá theo đơn, cơ sở dữ liệu chặn tổng hoàn vượt số đã trả | Cách tính ngày đổi theo ADR-0041; 4 lần bổ sung |
| [0029](0029-cancellation-approve-partial-refund.md) | Duyệt yêu cầu huỷ với mức hoàn theo chính sách | Bị ADR-0041 thay một phần: khách nay tự huỷ, không còn bước duyệt. Phần còn hiệu lực ghi ở đầu file; 6 lần bổ sung |
| [0030](0030-refund-policy-tiers.md) | Chính sách hoàn tiền theo bậc | Bị ADR-0041 thay một phần, phần còn hiệu lực ghi ở đầu file; 4 lần bổ sung |
| [0041](0041-single-cancellation-deadline.md) | Một hạn chót mỗi chuyến: qua mốc thì ngừng nhận đặt và hết huỷ miễn phí. Đây là luật hoàn tiền hiện hành | Thay một phần ADR-0029 và ADR-0030; 2 lần bổ sung (chuyến bị công ty huỷ thì khách không tự huỷ được nữa; khách đọc được lý do huỷ chuyến) |
| [0043](0043-refund-payment-event.md) | Mỗi lần hoàn tiền để lại một dòng trong sổ sự kiện thanh toán (`payment_events`) | |
| [0054](0054-customer-bookings-list-phase-filters.md) | Danh sách đơn của khách: một luật giai đoạn dùng chung; API lọc, tìm, xếp theo hành trình và phân trang | 1 lần bổ sung |

## Web khách

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0011](0011-p3b-web-architecture.md) | Kiến trúc web: Next.js 16 và thư viện giao diện dùng chung `libs/shared/ui` | |
| [0012](0012-typeset-typography.md) | Kiểu chữ cho nội dung dài (bài blog, mô tả tour) | |
| [0014](0014-web-component-testing.md) | Test tầng component cho web | 1 lần bổ sung |
| [0016](0016-web-data-layer.md) | Tầng dữ liệu web: gọi API qua oRPC, dựng ở server trước, cache theo thẻ và ISR | 4 lần bổ sung |
| [0018](0018-web-map-library.md) | Bản đồ trang `/contact`: maplibre-gl và OpenFreeMap | 2 lần bổ sung |
| [0022](0022-tour-detail-tabs.md) | Trang chi tiết tour chia thành 5 tab | |
| [0044](0044-prerender-retry-transient-api.md) | Bước dựng sẵn trang (*prerender*) thử lại khi API lỗi thoáng qua | 2 lần bổ sung; lần 2 (20/10/2026): thao tác ghi từ trình duyệt chờ bằng trần thời gian của API |
| [0058](0058-tour-card-next-departure-badges-rating-sort.md) | Thẻ tour hiện đợt khởi hành kế tiếp còn đặt được và nhãn (*badge*); sắp theo điểm đánh giá; bộ lọc giá, thời lượng, độ khó nằm ở web | |

## Màu sắc và giao diện chung

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0013](0013-wuling-theme-tokens.md) | Theme Wuling và màu nhấn theo vùng | Phần màu nhấn theo vùng đã bị ADR-0015 rút |
| [0015](0015-retire-region-tint.md) | Rút màu nhấn theo vùng khỏi toàn site | |
| [0019](0019-color-token-roles.md) | Chia vai token màu: bề mặt, chữ, và đường viền của ô điều khiển | 4 lần bổ sung (13–14/10/2026: màu cảnh báo, màu đỏ đạt độ tương phản ở cả hai theme, màu trạng thái cho app mobile) |
| [0027](0027-admin-surface-palette.md) | Bề mặt riêng cho trang quản trị: khung tối, phần nội dung nền trắng lạnh | 1 lần bổ sung |
| [0057](0057-print-documents.md) | Bản in là tài liệu riêng: component chỉ dùng khi in, trang in khổ A4, đầu trang và chân trang dùng chung | |

## Catalog tour, ảnh và nội dung

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0004](0004-post-visibility-helper.md) | Bài blog chỉ hiện ra qua đúng một hàm lọc (`publishedPostWhere`) | |
| [0005](0005-media-read-build-url.md) | Đọc ảnh: API dựng sẵn URL Cloudinary | |
| [0020](0020-real-images-sourcing.md) | Ảnh thật: nguồn, ghi công tác giả, cách đưa vào catalog | Mục 1 đã sửa vì lô ảnh đầu bị loại toàn bộ; 1 lần bổ sung |
| [0021](0021-media-write-surface.md) | Khách tải ảnh lên (ảnh đại diện, ảnh đánh giá) bằng chữ ký tải thẳng lên Cloudinary | 3 lần bổ sung |
| [0023](0023-tour-merchandising-fields.md) | Năm cột nội dung bán hàng cho tour | Cột `freeCancellationDays` đã bỏ theo ADR-0041; 1 lần bổ sung |
| [0035](0035-media-lifecycle.md) | Vòng đời ảnh: ảnh không còn dùng đi qua hàng đợi xoá có độ trễ | 4 lần bổ sung; lần 4 (19/10/2026): hàng đợi xoá có màn xem chỉ đọc |
| [0045](0045-region-vocabulary-in-contract.md) | Ba vùng miền là từ vựng chung, khai trong `@tourism/contract` | |
| [0046](0046-departure-phase-derived.md) | Giai đoạn chuyến suy ra từ ngày; cột `status` chỉ là công tắc bán hàng | 1 lần bổ sung |
| [0047](0047-tour-editor-sections.md) | Sửa tour theo từng khối: thay nguyên danh sách, khoá theo phiên bản, điều kiện để đăng tour | |
| [0048](0048-tour-photos.md) | Ảnh tour: một danh sách có thứ tự, kho ảnh địa danh làm thư viện, chỉ ảnh tự tải lên mới bị dọn | 2 lần bổ sung |
| [0049](0049-tour-workspace-steps.md) | Khu sửa tour dạng thanh bước: form bên trái, cột phải hiện ngữ cảnh của bước, bước cuối là xem lại và đăng | 1 lần bổ sung |
| [0051](0051-posts-admin.md) | Quản trị bài viết: soạn markdown có xem trước, slug đặt một lần, đủ thông tin mới được đăng | |
| [0053](0053-delete-unused-categories-destinations.md) | Xoá danh mục và điểm đến khi chưa tour nào dùng | 2 lần bổ sung; lần 2 (15/10/2026): khoá ngoại điểm đến của tour đổi sang `RESTRICT` |
| [0059](0059-site-slot-appearance.md) | Appearance: danh sách khe ảnh của web khai trong contract, bốn nguồn ảnh cho một lần lưu, ảnh gốc nằm trong code API | |
| [0060](0060-media-library.md) | Media library: mỗi ảnh định danh bằng một `publicId`, sửa ghi công một lần cho mọi chỗ dùng, hàng đợi xoá chỉ đọc, ảnh điểm đến có trình sửa riêng | |

## Email, đánh giá và liên hệ

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0025](0025-transactional-email-react-email.md) | Email giao dịch viết bằng react-email ngay trong code, không soạn trên dashboard của Resend | |
| [0031](0031-review-rejection.md) | Từ chối một đánh giá là quyết định cuối cùng | 1 lần bổ sung (28/09/2026: lý do từ chối chọn từ danh sách) |
| [0032](0032-review-author-edit.md) | Tác giả được sửa lại đánh giá bị từ chối, có giới hạn số vòng | 2 lần bổ sung |
| [0039](0039-inbound-channels-outbound-email.md) | Kênh khách gửi vào và email gửi ra: thư xác nhận, đồng ý nhận tin hai bước, danh sách chặn gửi | 1 lần bổ sung |

## Trang quản trị và báo cáo

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0026](0026-p4-admin-app.md) | Trang quản trị là app riêng, dùng chung phiên đăng nhập qua tên miền con | 5 lần bổ sung |
| [0028](0028-bookings-stats-follow-filter.md) | Thẻ số liệu của danh sách đơn đổi theo bộ lọc ngày | 3 lần bổ sung, mở rộng sang `/cancellations` và `/reviews` |
| [0033](0033-financial-model.md) | Báo cáo có kết quả kinh doanh, không chỉ dòng tiền | Định nghĩa doanh thu sửa ở ADR-0041 §9; 4 lần bổ sung (lần 3: tháng đang chạy chỉ tính chuyến đã kết thúc; lần 4, 20/10/2026: hai bộ đếm huỷ chỉ đếm lượt khách tự huỷ) |
| [0034](0034-excel-report-export.md) | Báo cáo tháng xuất file Excel; từ lần bổ sung 3 (10/10/2026) các danh sách cũng xuất Excel thay cho CSV | 3 lần bổ sung |
| [0036](0036-dashboard-daily-series.md) | Dashboard lấy số thật từ một chuỗi số liệu theo ngày | 3 lần bổ sung; lần 3 (20/10/2026): bốn thẻ ở trang đầu luôn đọc số mới |
| [0052](0052-admin-staff-tier.md) | Nhân sự quản trị hai bậc: Owner khai trong `ADMIN_EMAILS`, Staff do Owner cấp; khoá tài khoản thì không tạo được phiên | 1 lần bổ sung |
| [0061](0061-admin-activity-log.md) | Nhật ký thao tác quản trị: một bảng chỉ ghi thêm, tự ghi sau mỗi lệnh ghi thành công, chỉ Owner xem | |

## App điện thoại

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0040](0040-mobile-app-expo.md) | App mobile viết bằng Expo, nằm chung monorepo | 8 lần bổ sung; lần 8 (26/10/2026): cài Reanimated theo ADR-0063 |
| [0055](0055-mobile-data-layer.md) | Tầng dữ liệu mobile: oRPC và TanStack Query, gọi API từ máy của khách | 2 lần bổ sung |
| [0056](0056-mobile-google-native-signin.md) | Đăng nhập Google trên app bằng SDK gốc và ID token | 1 lần bổ sung |
| [0062](0062-mobile-checkout-app-return.md) | Thanh toán trên app: cổng thanh toán trả về một trang web chuyển tiếp, trang này đưa khách về lại app | |
| [0063](0063-mobile-reanimated.md) | App dùng Reanimated cho chuyển động theo ngón tay và theo bố cục, ghim đúng bản đi kèm Expo Go; Jest dùng bản thay thế | Đảo lần bổ sung 3 của ADR-0040 |

## Trợ lý AI

| ADR | Quyết định | Ghi chú |
| --- | --- | --- |
| [0050](0050-ai-concierge-chat.md) | Trợ lý AI tư vấn tour: chat chạy trong API, lịch sử lưu ở server, thao tác ghi phải được khách duyệt, có trần chi phí | 2 lần bổ sung; lần 2 (19/10/2026): đọc được đơn của chính khách, có nút mở thẳng khung chat |

## Thêm ADR mới

Viết ADR trước khi viết code. Đặt tên file `NNNN-ten-tieng-anh.md` với số kế tiếp
sau ADR lớn nhất, mở đầu bằng khối Trạng thái, Bối cảnh, Liên quan như các ADR có
sẵn, rồi thêm một dòng vào nhóm phù hợp trong các bảng trên.
