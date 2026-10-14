# Analysis — đo đạc và rà soát

> Mục lục của `analysis/`. Bản đồ chung của tài liệu ở [../README.md](../README.md).

Trừ file đánh dấu **sống**, tất cả là ảnh chụp một thời điểm: đọc để lấy dữ
liệu, đừng coi là hiện trạng.

## Ở gốc thư mục

| Tài liệu | Dùng để |
| --- | --- |
| [**Sổ nợ kỹ thuật**](2026-08-06-backlog-no-ky-thuat.md) | **Sống.** Đọc TRƯỚC khi mở cụm việc mới, bắt buộc trước đợt thiết kế lại |
| [**Rà bảo mật web 05/09**](2026-09-05-web-security-audit.md) | Đọc trước mỗi đợt vá web — 8 cụm nhìn từ kẻ tấn công, ~55 phát hiện |
| [Rà soát độc lập toàn API](2026-07-21-independent-review.md) | 4 lỗi nặng, chùm lỗi vừa, 19 bất biến được canh |
| [Hệ màu — nguồn gốc và số đo](2026-07-22-color-system-analysis.md) | Màu từ đâu ra, đo thế nào, ba palette vùng đã rút. Luật còn hiệu lực ở [conventions](../conventions/color-system.md) |

## `nexora-parity/` — đối chiếu với Nexora

Bản sao Nexora không còn trên máy (chốt 14/09/2026), nên mọi lần đối chiếu theo
luật 10 của CLAUDE.md đọc các bản ghi dưới đây.

| Tài liệu | Dùng để |
| --- | --- |
| [Schema audit](nexora-parity/2026-07-18-schema-audit-nexora.md) | 27 model của dự án cũ và quyết định tối ưu cho bản này |
| [API parity + upgrade map](nexora-parity/2026-07-19-api-parity-upgrade-map.md) | ~64 endpoint còn thiếu, 14 nâng cấp, 10 khác biệt schema |
| [Infra parity](nexora-parity/2026-07-19-infra-parity-nexora.md) | 8 lỗ hạ tầng mà bản đếm endpoint bỏ lọt |
| [Quét sâu Nexora](nexora-parity/2026-07-19-nexora-deep-sweep.md) | Bảng theo dõi A1–A11 + quy tắc nghiệp vụ |
| [Kiểm kê biến môi trường](nexora-parity/2026-07-19-env-keys-inventory.md) | Khoá nào đã có, khoá nào còn thiếu |
| [Sweep parity trước P3a-B](nexora-parity/2026-07-21-full-parity-sweep-pre-p3ab.md) | 7 vùng, 7 agent chạy song song |
| [Đối chiếu P3a-B](nexora-parity/2026-07-21-p3a-b-parity-recheck.md) | Wishlist · enquiry · newsletter |
| [Độ sẵn sàng backend](nexora-parity/2026-07-22-backend-readiness-vs-nexora.md) | Quyết định mở hay chưa mở phần web |
| [Đối chiếu cụm Tours](nexora-parity/2026-07-27-tours-parity-nexora.md) | Listing và detail, hai tầng |
| [Đối chiếu tầng dữ liệu web](nexora-parity/2026-07-31-web-data-layer-parity-nexora.md) | Nền của ADR-0016 |
| [Khảo sát admin Nexora](nexora-parity/2026-08-20-admin-parity-nexora.md) | Mở màn P4; các ADR admin về sau còn trích |

## `progress/` — báo cáo tiến độ và các đợt rà tài liệu

| Tài liệu | Dùng để |
| --- | --- |
| [Rà docs ↔ code 30/07](progress/2026-07-30-docs-audit-progress.md) | Ảnh chụp trước khi viết dòng API đầu tiên cho web, kèm thứ tự nối API 10 bước |
| [Đại tu docs 03/08](progress/2026-08-03-docs-overhaul-audit.md) | Đợt rà soát tài liệu lần thứ nhất |
| [Báo cáo tiến độ 04/08](progress/2026-08-04-progress-report.md) | Mốc trước bước 8–10 |
| [Báo cáo tiến độ 20/08](progress/2026-08-20-progress-report.md) | Mốc site sống thật |
| [Rà soát docs 21/09](progress/2026-09-21-docs-audit.md) | Đợt đại tu thứ hai: bản đồ gọn lại, thêm trang cho người đọc phổ thông, tách CHANGELOG (xong 21/09) |
| [Rà soát docs 14/10](progress/2026-10-14-docs-audit.md) | Đợt thứ ba: sắp lại thư mục, tách CHANGELOG và open-items, sửa thông tin lỗi thời |
