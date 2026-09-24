# Tài liệu — tourism-v2

Đây là **cửa vào duy nhất**. Mọi tài liệu của dự án nằm dưới `docs/` và được
liệt kê ở đây; tài liệu không có trong bản đồ này coi như không tồn tại.

## Bạn đang cần gì?

| Câu hỏi | Đọc |
| --- | --- |
| Dự án này là gì, ai dùng, chạy thế nào? | [overview.md](overview.md) |
| Từ này nghĩa là gì? | [glossary.md](glossary.md) |
| Còn nợ việc gì? | [open-items.md](open-items.md) |
| Vì sao lại chọn cách làm này? | [`adr/`](adr/) — xem bảng bên dưới |
| Đợt vừa rồi đã đổi những gì? | [CHANGELOG.md](CHANGELOG.md) |
| Luật nào áp dụng mãi mãi? | [`conventions/`](conventions/) |
| Quy ước làm việc trong kho mã? | [../CLAUDE.md](../CLAUDE.md) |

## Bảy thể loại, đừng lẫn

| Thư mục | Trả lời câu hỏi | Viết khi nào |
| --- | --- | --- |
| [`adr/`](adr/) | **Vì sao** chọn thế này? | TRƯỚC khi code (luật CLAUDE.md #5) |
| [`specs/`](specs/) | **Sẽ xây gì** ở đợt này? | Đầu mỗi đợt, user duyệt rồi mới code |
| [`plans/`](plans/) | **Làm theo bước nào**? | Sau khi spec được duyệt |
| [`analysis/`](analysis/) | **Đo được gì**? | Khi cần dữ liệu để ra quyết định |
| [`conventions/`](conventions/) | Quy tắc **áp dụng mãi mãi** | Khi một bài học cần thành luật |
| [`handoff/`](handoff/README.md) | **Người khác** nhận việc này thì làm gì? | Khi giao một cụm việc cho thành viên khác |
| [`design/`](design/) | Đồ nghề thiết kế | Khi cần dựng trang mới ngoài code |

Ranh giới dễ lẫn nhất là **conventions ↔ handoff**: luật thì áp dụng mãi mãi,
bàn giao thì có ngày hết hạn — dựng xong cụm màn là tài liệu ấy thành lịch sử.

Ngoài ra: [`snapshots/`](snapshots/README.md) — ảnh chụp cơ sở dữ liệu prod xuất
trước mỗi đợt làm mới dữ liệu, có [mục lục riêng](snapshots/README.md); KHÔNG
chứa dữ liệu cá nhân vì kho mã này công khai. Và
[`skills.md`](skills.md) — skill đã cài, dùng khi nào.

## ADR — quyết định kiến trúc

Mỗi ADR tự chứa đầy đủ phần sửa bổ sung (AMEND) của nó; bảng này chỉ để tìm
đường. Số 0007 bỏ trống.

| # | Quyết định | Lưu ý |
| --- | --- | --- |
| [0001](adr/0001-tech-stack.md) | Tech stack cho bản rebuild | |
| [0002](adr/0002-payment-gateway-refund-ledger.md) | `PaymentGateway`, sổ hoàn tiền, atomic claim | |
| [0003](adr/0003-auth-fail-closed.md) | Auth mặc định đóng, mở từng route bằng `@Public()` | |
| [0004](adr/0004-post-visibility-helper.md) | Bài blog hiện ra qua đúng một helper | |
| [0005](adr/0005-media-read-build-url.md) | Đọc ảnh: API dựng URL Cloudinary | |
| [0006](adr/0006-pending-lifecycle.md) | Vòng đời đơn chưa trả tiền: hết hạn, tự huỷ, mở lại được | |
| [0008](adr/0008-admin-bootstrap-verified.md) | Cấp quyền admin phải qua email đã xác minh | |
| [0009](adr/0009-refund-correctness.md) | Đúng đắn hoàn tiền: khoá, trigger tổng, gate | thước ngày đổi theo [0041](adr/0041-single-cancellation-deadline.md) |
| [0010](adr/0010-infra-hardening.md) | Gia cố hạ tầng trước P3b | |
| [0011](adr/0011-p3b-web-architecture.md) | Kiến trúc web: Next.js 16 + `libs/shared/ui` | |
| [0012](adr/0012-typeset-typography.md) | Typography cho nội dung dài | |
| [0013](adr/0013-wuling-theme-tokens.md) | Theme Wuling + tint theo vùng | tint **đã rút** — xem [0015](adr/0015-retire-region-tint.md) |
| [0014](adr/0014-web-component-testing.md) | Test tầng component cho web | |
| [0015](adr/0015-retire-region-tint.md) | Rút tint theo vùng toàn site | |
| [0016](adr/0016-web-data-layer.md) | Tầng dữ liệu web: oRPC, server-first, ISR + cache-tag | 3 AMEND |
| [0017](adr/0017-web-session-better-auth.md) | Phiên đăng nhập: cookie thẳng trình duyệt ↔ API | 3 AMEND |
| [0018](adr/0018-web-map-library.md) | Bản đồ `/contact`: maplibre-gl + OpenFreeMap | |
| [0019](adr/0019-color-token-roles.md) | Tách vai token màu: bề mặt · chữ · ranh giới | |
| [0020](adr/0020-real-images-sourcing.md) | Ảnh thật: nguồn, ghi công, đường vào catalog | mục 1 đã sửa — lô ảnh đầu bị loại toàn bộ |
| [0021](adr/0021-media-write-surface.md) | Khách tải ảnh lên: ký trực tiếp Cloudinary | 2 AMEND |
| [0022](adr/0022-tour-detail-tabs.md) | Trang chi tiết tour chuyển sang 5 tab | |
| [0023](adr/0023-tour-merchandising-fields.md) | Năm cột nội dung bán hàng cho tour | cột `freeCancellationDays` đã xoá theo [0041](adr/0041-single-cancellation-deadline.md) |
| [0024](adr/0024-deploy-targets.md) | Nơi deploy v1: Vercel · Render · Supabase · Resend | 3 AMEND |
| [0025](adr/0025-transactional-email-react-email.md) | Email giao dịch viết bằng react-email, không dùng dashboard | |
| [0026](adr/0026-p4-admin-app.md) | Admin là app riêng, dùng chung phiên qua subdomain | 5 AMEND |
| [0027](adr/0027-admin-surface-palette.md) | Bề mặt riêng cho admin: vỏ tối, ruột trắng lạnh | |
| [0028](adr/0028-bookings-stats-follow-filter.md) | Thẻ số liệu ăn theo bộ lọc ngày | |
| [0029](adr/0029-cancellation-approve-partial-refund.md) | Duyệt yêu cầu huỷ với mức hoàn theo chính sách | **đã thay** bởi [0041](adr/0041-single-cancellation-deadline.md) |
| [0030](adr/0030-refund-policy-tiers.md) | Chính sách hoàn tiền theo bậc | **đã thay** bởi [0041](adr/0041-single-cancellation-deadline.md) |
| [0031](adr/0031-review-rejection.md) | Từ chối đánh giá là quyết định chung cuộc | |
| [0032](adr/0032-review-author-edit.md) | Tác giả sửa lại đánh giá bị bác, có trần vòng lặp | |
| [0033](adr/0033-financial-model.md) | Báo cáo có kết quả kinh doanh, không chỉ dòng tiền | định nghĩa doanh thu sửa ở [0041](adr/0041-single-cancellation-deadline.md) §9 |
| [0034](adr/0034-excel-report-export.md) | Báo cáo tháng xuất Excel; CSV giữ đúng chỗ | |
| [0035](adr/0035-media-lifecycle.md) | Ảnh có đường chết, đi qua hàng đợi có độ trễ | |
| [0036](adr/0036-dashboard-daily-series.md) | Dashboard nối số thật bằng một chuỗi theo ngày | |
| [0037](adr/0037-default-write-throttle.md) | Mọi route ghi sinh ra đã có trần | |
| [0038](adr/0038-web-shell-security-headers.md) | Security header + CSP cho web và admin | |
| [0039](adr/0039-inbound-channels-outbound-email.md) | Kênh vào và email đi ra: ack, consent, suppression | |
| [0040](adr/0040-mobile-app-expo.md) | App mobile Expo trong monorepo | |
| [0041](adr/0041-single-cancellation-deadline.md) | **Một hạn chót mỗi chuyến** — luật hoàn tiền hiện hành | thay 0029, 0030 |
| [0042](adr/0042-shared-client-rules-core.md) | `@tourism/core`: luật dùng chung cho mọi client | |
| [0043](adr/0043-refund-payment-event.md) | Hoàn tiền để lại vết ở sổ `payment_events` | |
| [0044](adr/0044-prerender-retry-transient-api.md) | Prerender thử lại khi API hắt hơi | |
| [0045](adr/0045-region-vocabulary-in-contract.md) | Ba vùng miền là từ vựng chung, sống ở contract | |
| [0046](adr/0046-departure-phase-derived.md) | Giai đoạn chuyến suy từ ngày; `status` chỉ là công tắc bán hàng | |
| [0047](adr/0047-tour-editor-sections.md) | Sửa tour theo từng khối: thay nguyên danh sách, khoá phiên bản, cổng đăng tour | |

## Specs — sẽ xây gì

Mỗi spec đi kèm một plan cùng tên ở [`plans/`](plans/), trừ vài đợt gộp.

**Nền móng (P1–P3a)**
[P1 API lõi](specs/2026-07-18-p1-api-core.md) ·
[P2 money-path](specs/2026-07-18-p2-money-path.md) ·
[P3a API khách](specs/2026-07-19-p3a-customer-api.md) ·
[P3a đóng contract](specs/2026-07-21-p3a-contract-closeout-design.md)

**Web tĩnh (P3b)**
[typeset](specs/2026-07-22-ui-typeset-design.md) ·
[theme Wuling](specs/2026-07-22-wuling-theme-tokens-design.md) ·
[Home](specs/2026-07-23-home-page-design.md) ·
[Auth](specs/2026-07-24-auth-pages-design.md) ·
[Blog](specs/2026-07-25-blog-pages-design.md) ·
[pháp lý/utility](specs/2026-07-25-legal-utility-pages-design.md) ·
[Tours](specs/2026-07-27-tours-pages-design.md) ·
[Destinations](specs/2026-07-28-destinations-pages-design.md)

**Nối web vào API**
[Blog + nền `lib/api`](specs/2026-07-31-blog-api-design.md) ·
[Destinations](specs/2026-07-31-destinations-api-design.md) ·
[catalogue thật](specs/2026-07-31-tours-catalogue-api-design.md) ·
[Contact + Newsletter](specs/2026-08-03-contact-newsletter-api-design.md) ·
[Auth + phiên](specs/2026-08-03-auth-pages-api-design.md) ·
[on-demand revalidation](specs/2026-08-03-on-demand-revalidation-design.md) ·
[khu Account](specs/2026-08-04-account-area-design.md) ·
[PayPal capture + smoke](specs/2026-08-04-paypal-capture-smoke-design.md) ·
[bản đồ /contact](specs/2026-08-06-contact-map-offices-design.md) ·
[booking + checkout](specs/2026-08-07-booking-checkout-design.md)

**Các vòng thiết kế lại**
[khu account](specs/2026-08-08-account-redesign-design.md) ·
[checkout + account](specs/2026-08-10-checkout-account-redesign.md) ·
[account "Hộ chiếu"](specs/2026-08-11-account-passport-redesign.md) ·
[tour detail](specs/2026-08-13-tour-detail-redesign.md)

**Deploy và admin (P4)**
[deploy v1](specs/2026-08-19-deploy-v1-design.md) ·
[P4a scaffold](specs/2026-08-20-p4a-admin-scaffold-design.md) ·
[P4b kit + 3 vùng](specs/2026-08-31-p4b-admin-ready-areas-design.md) ·
[export theo lựa chọn](specs/2026-09-01-bookings-export-selection-design.md) ·
[P4c vận hành](specs/2026-09-02-p4c-operations-design.md)

**Bảo mật và hạ tầng (W3–W4)**
[W3 vỏ Next + CSP](specs/2026-09-07-w3-web-shell-headers-design.md) ·
[W4 kênh vào + email](specs/2026-09-07-w4-inbound-channels-design.md)

**Mobile, dữ liệu và hoàn tiền (P5, gần đây nhất)**
[P5a template](specs/2026-09-08-p5a-mobile-template-design.md) ·
[lịch vận hành 2026](specs/2026-09-10-seed-lich-van-hanh-2026-design.md) ·
[seed trọn năm 2026](specs/2026-09-14-seed-khung-2026-design.md) ·
[**một hạn chót**](specs/2026-09-15-refund-deadline-design.md) ·
[P5b-1 auth mobile](specs/2026-09-16-p5b-auth-wireframe-design.md)

**Admin catalog (P4e, đang mở)**
[**P4e-1 chuyến + trạng thái đăng**](specs/2026-09-21-p4e-1-departures-design.md) ·
[**P4e-2 danh mục + điểm đến**](specs/2026-09-22-p4e-2-categories-destinations-design.md) ·
[**F16 giai đoạn chuyến**](specs/2026-09-23-departure-phase-design.md) ·
[**F17 tạo và sửa tour (P4e-3a)**](specs/2026-09-24-p4e-3a-tour-editor-design.md)

## Plans — làm theo bước nào

Kế hoạch thi công, **hầu hết đã đóng**; kết quả thật của mỗi kế hoạch nằm ở
entry CHANGELOG cùng ngày.

**P3a backend**
[nền + reviews](plans/2026-07-19-p3a-a-foundation-reviews.md) ·
[wishlist · enquiry · newsletter](plans/2026-07-19-p3a-b-wishlist-enquiry-newsletter.md) ·
[posts · site-media](plans/2026-07-21-p3a-c-posts-site-media.md) ·
[đóng contract](plans/2026-07-21-p3a-contract-closeout.md) ·
[admin bootstrap](plans/2026-07-21-admin-bootstrap-verified.md) ·
[đúng đắn refund](plans/2026-07-21-refund-correctness.md) ·
[vòng đời PENDING](plans/2026-07-22-pending-lifecycle.md)

**P3b web tĩnh**
[typeset](plans/2026-07-22-ui-typeset.md) ·
[theme Wuling](plans/2026-07-22-wuling-theme-tokens.md) ·
[Home](plans/2026-07-23-home-page.md) ·
[Auth](plans/2026-07-24-auth-pages.md) ·
[Blog](plans/2026-07-25-blog-pages.md) ·
[pháp lý/utility](plans/2026-07-25-legal-utility-pages.md) ·
[Tours](plans/2026-07-27-tours-pages.md) ·
[Destinations](plans/2026-07-28-destinations-pages.md)

**Nối API và khu account**
[Blog](plans/2026-07-31-blog-api.md) ·
[Destinations](plans/2026-07-31-destinations-api.md) ·
[catalogue](plans/2026-07-31-tours-catalogue-api.md) ·
[Contact + Newsletter](plans/2026-08-03-contact-newsletter-api.md) ·
[Auth + phiên](plans/2026-08-03-auth-pages-api.md) ·
[revalidation](plans/2026-08-03-on-demand-revalidation.md) ·
[khu Account](plans/2026-08-04-account-area.md) ·
[PayPal](plans/2026-08-04-paypal-capture-smoke.md) ·
[bản đồ /contact](plans/2026-08-06-contact-map-offices.md) ·
[media ghi (ADR-0021)](plans/2026-08-12-media-write-surface.md)

**Thiết kế lại và P4**
[account](plans/2026-08-10-account-redesign.md) ·
[checkout + account](plans/2026-08-10-checkout-account-redesign.md) ·
[account "Hộ chiếu"](plans/2026-08-11-account-passport.md) ·
[tour detail](plans/2026-08-13-tour-detail-redesign.md) ·
[wizard checkout](plans/2026-08-19-checkout-wizard.md) ·
[receipt success](plans/2026-08-19-receipt-success.md) ·
[export theo lựa chọn](plans/2026-09-01-bookings-export-selection.md) ·
[thẻ số liệu theo bộ lọc](plans/2026-09-04-bookings-stats-follow-filter.md) ·
[mô hình tài chính + Excel](plans/2026-09-05-financial-model-excel-report.md)

**Mobile, seed, hoàn tiền**
[prompt P5a](plans/2026-09-08-p5a-prompt-thi-cong.md) ·
[prompt các phase còn lại](plans/2026-09-08-prompts-cac-phase-con-lai.md) ·
[seed trọn năm 2026](plans/2026-09-14-seed-khung-2026.md) ·
[**một hạn chót**](plans/2026-09-15-refund-deadline.md) ·
[P5b-1 auth mobile](plans/2026-09-16-p5b-auth-wireframe.md) ·
[**P4e-1 chuyến khởi hành**](plans/2026-09-21-p4e-1-departures.md) ·
[prompt ba session P4e-1](plans/2026-09-21-p4e-1-prompts.md) ·
[**P4e-2 danh mục + điểm đến**](plans/2026-09-22-p4e-2-categories-destinations.md) ·
[**F16 giai đoạn chuyến** (kèm prompt thi công)](plans/2026-09-23-departure-phase.md) ·
[**F17 tạo và sửa tour (P4e-3a)** (kèm prompt thi công)](plans/2026-09-24-p4e-3a-tour-editor.md)

## Conventions — luật áp dụng mãi

| Tài liệu | Nội dung |
| --- | --- |
| [booking-states](conventions/booking-states.md) | Sổ tiền kể chuyện tiền, trạng thái kể chuyện ghế — 5 kết cục của một đơn |
| [outbox-dedupe-key](conventions/outbox-dedupe-key.md) | Cách đặt khoá chống-gửi-trùng cho email |
| [read-then-write-races](conventions/read-then-write-races.md) | Bẫy đọc-rồi-ghi dưới Read Committed — đã cắn dự án 2 lần |
| [soft-404-loading-tsx](conventions/soft-404-loading-tsx.md) | `loading.tsx` trên route động biến 404 thành 200 |
| [color-system](conventions/color-system.md) | Codename không rời kho mã · tỷ lệ phối · bộ font · luật hero luôn tối |
| [supabase-data-api-surface](conventions/supabase-data-api-surface.md) | Bề mặt Supabase sau khi tắt Data API — đọc TRƯỚC khi bật lại thứ gì |
| [mobile-dev-loop](conventions/mobile-dev-loop.md) | Chạy thử app mobile, nghiệm thu, và 6 bẫy đã cắn |

## Handoff — bàn giao cho người khác dựng

Năm cụm màn app điện thoại (P5b), mục lục và ranh giới ở
[handoff/README.md](handoff/README.md):
[đăng nhập](handoff/mobile-auth-handoff.md) ·
[xem tour](handoff/mobile-browse-handoff.md) (**đọc trước ba cụm dưới**) ·
[đặt tour](handoff/mobile-booking-handoff.md) ·
[tài khoản](handoff/mobile-account-handoff.md) ·
[đánh giá](handoff/mobile-review-handoff.md)

## Analysis — đo đạc và rà soát

Trừ hai file đánh dấu **sống**, tất cả là ảnh chụp một thời điểm: đọc để lấy dữ
liệu, đừng coi là hiện trạng.

| Tài liệu | Dùng để |
| --- | --- |
| [**Sổ nợ kỹ thuật**](analysis/2026-08-06-backlog-no-ky-thuat.md) | **Sống.** Đọc TRƯỚC khi mở cụm việc mới, bắt buộc trước đợt thiết kế lại |
| [**Rà bảo mật web 05/09**](analysis/2026-09-05-web-security-audit.md) | Đọc trước mỗi đợt vá web — 8 cụm nhìn từ kẻ tấn công, ~55 phát hiện |
| [Rà soát docs 21/09](analysis/2026-09-21-docs-audit.md) | **Sống.** Đợt đại tu tài liệu đang chạy: quy mô, vấn đề, 4 đợt sửa |
| [Hệ màu — nguồn gốc và số đo](analysis/2026-07-22-color-system-analysis.md) | Màu từ đâu ra, đo thế nào, ba palette vùng đã rút. Luật còn hiệu lực ở [conventions](conventions/color-system.md) |
| [Schema audit](analysis/2026-07-18-schema-audit-nexora.md) | 27 model của dự án cũ và quyết định tối ưu cho bản này |
| [API parity + upgrade map](analysis/2026-07-19-api-parity-upgrade-map.md) | ~64 endpoint còn thiếu, 14 nâng cấp, 10 khác biệt schema |
| [Infra parity](analysis/2026-07-19-infra-parity-nexora.md) | 8 lỗ hạ tầng mà bản đếm endpoint bỏ lọt |
| [Quét sâu Nexora](analysis/2026-07-19-nexora-deep-sweep.md) | Bảng theo dõi A1–A11 + quy tắc nghiệp vụ |
| [Kiểm kê biến môi trường](analysis/2026-07-19-env-keys-inventory.md) | Khoá nào đã có, khoá nào còn thiếu |
| [Đối chiếu P3a-B](analysis/2026-07-21-p3a-b-parity-recheck.md) | Wishlist · enquiry · newsletter |
| [Rà soát độc lập toàn API](analysis/2026-07-21-independent-review.md) | 4 lỗi nặng, chùm lỗi vừa, 19 bất biến được canh |
| [Sweep parity trước P3a-B](analysis/2026-07-21-full-parity-sweep-pre-p3ab.md) | 7 vùng, 7 agent chạy song song |
| [Độ sẵn sàng backend](analysis/2026-07-22-backend-readiness-vs-nexora.md) | Quyết định mở hay chưa mở phần web |
| [Đối chiếu cụm Tours](analysis/2026-07-27-tours-parity-nexora.md) | Listing và detail, hai tầng |
| [Rà docs ↔ code 30/07](analysis/2026-07-30-docs-audit-progress.md) | Ảnh chụp trước khi viết dòng API đầu tiên cho web |
| [Đối chiếu tầng dữ liệu web](analysis/2026-07-31-web-data-layer-parity-nexora.md) | Nền của ADR-0016 |
| [Đại tu docs 03/08](analysis/2026-08-03-docs-overhaul-audit.md) | Đợt rà soát tài liệu lần trước |
| [Báo cáo tiến độ 04/08](analysis/2026-08-04-progress-report.md) | Mốc trước bước 8–10 |
| [Báo cáo tiến độ 20/08](analysis/2026-08-20-progress-report.md) | Mốc site sống thật |
| [Khảo sát admin Nexora](analysis/2026-08-20-admin-parity-nexora.md) | Mở màn P4 |

## Design — đồ nghề thiết kế

| Tài liệu | Nội dung |
| --- | --- |
| [claude-design-brief](design/claude-design-brief.md) | Brief ngôn ngữ thiết kế. Là **bản trích** — code thắng, lệch thì sửa brief |
| [prompt-booking](design/prompt-booking.md) | Prompt đã dùng để sinh mockup luồng đặt tour (04/08). Nội dung một-trang đã bị wizard 4 bước thay — giữ làm truy vết |
| [references](design/references.md) | Mẫu đã khảo sát cho khu account và booking |
| [mockups/](design/mockups/README.md) | Nguồn HTML của các bản demo, có mục lục riêng |

**Mockup là bản ghi bất biến** của một vòng thiết kế đã được duyệt — không sửa,
không xoá vì "đã làm xong": 20 chỗ trong mã nguồn trích số đo từ chúng, và 6
vòng thiết kế không có tài liệu nào khác ngoài mockup (đo 21/09).

## CHANGELOG

[CHANGELOG.md](CHANGELOG.md) — một entry mỗi lần gộp nhánh: ngày · hash · nội
dung · phát hiện khi review · tổng số test. File chính **chỉ giữ đợt đang chạy**
(từ 15/09/2026); lịch sử trước đó nằm ở [`changelog/`](changelog/), 12 file theo
kỷ nguyên.

Vào bằng [**mục lục lưu trữ**](changelog/README.md): nó kể lại dự án đã đi qua
những gì theo thứ tự thời gian, mỗi giai đoạn vài dòng ngôn ngữ thường, rồi trỏ
tới bản ghi gốc.

**Entry đã ghi là bất biến** — cùng luật với `migration.sql`. Archive là di
chuyển nguyên văn, không sửa một ký tự.

## Quy tắc viết

- **ADR trước code**; spec được user duyệt trước khi triển khai.
- **CHANGELOG là nơi duy nhất** giữ lịch sử và tiến trình số test.
- Doc hiện-trạng giữ NGẮN, chỉ phản ánh hiện tại; chuyện đã qua để CHANGELOG lo.
- **Bản đồ này chỉ dẫn đường, không tóm tắt nội dung.** Mỗi mục một dòng; chi
  tiết sống trong chính tài liệu đó. Bản đồ mà dài bằng tài liệu thì không ai đọc.
- Dòng văn bản gói ở khoảng 80 cột như phần còn lại của kho mã.
- **Tên file đặt bằng tiếng Anh** (`overview.md`, `booking-states.md`), không
  dùng tiếng Việt bỏ dấu. Nội dung bên trong vẫn viết tiếng Việt có dấu đầy đủ.
  Sáu file đặt tên theo lối cũ (`…-no-ky-thuat`, `…-thi-cong`, `…-khung-2026`,
  `…-cac-phase-con-lai`, `…-lich-van-hanh-2026`) **giữ nguyên**: entry CHANGELOG
  là bất biến và đang trỏ tới chúng năm chỗ, đổi tên là làm gãy bản ghi lịch sử.
- Spec sinh từ skill `superpowers:brainstorming` cũng ghi vào `specs/`, plan ghi
  vào `plans/` — **không tạo thư mục riêng cho skill**.
