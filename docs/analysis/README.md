# Phân tích và rà soát

Thư mục này giữ các bản đo đạc và rà soát làm nền cho quyết định kỹ thuật. Trừ sổ
nợ kỹ thuật, mỗi file là ảnh chụp tại một thời điểm: đọc để lấy dữ liệu và lý do,
đừng coi là hiện trạng của code.

## Ở gốc thư mục

| Tài liệu | Nội dung |
| --- | --- |
| [Sổ nợ kỹ thuật](2026-08-06-backlog-no-ky-thuat.md) | Việc kỹ thuật còn nợ, vẫn được cập nhật. Đọc trước khi mở một cụm việc mới |
| [Rà bảo mật web 05/09/2026](2026-09-05-web-security-audit.md) | Khoảng 55 phát hiện, chia thành 8 cụm nhìn từ phía kẻ tấn công. Đọc trước mỗi đợt vá web |
| [Rà soát độc lập toàn API 21/07/2026](2026-07-21-independent-review.md) | 4 lỗi nặng, nhóm lỗi mức vừa và 19 bất biến được canh |
| [Hệ màu: nguồn gốc và số đo](2026-07-22-color-system-analysis.md) | Màu lấy từ đâu, đo thế nào, ba bảng màu theo vùng. Luật còn hiệu lực nằm ở [quy ước hệ màu](../conventions/color-system.md) |

## `nexora-parity/`: đối chiếu với dự án cũ

Ở thư mục này, Nexora là dự án cũ mà repo này viết lại và nâng cấp; từ 19/08/2026
Nexora cũng là tên thương hiệu của chính sản phẩm (xem [thuật ngữ](../glossary.md)).
Trước mỗi giai đoạn, nhóm đối chiếu với dự án cũ để không đánh rơi tính năng hay
lớp hạ tầng nào. Mã nguồn dự án cũ không nằm trong repo này, nên các bản ghi dưới
đây là bằng chứng duy nhất của những lần đối chiếu.

| Tài liệu | Nội dung |
| --- | --- |
| [Rà schema](nexora-parity/2026-07-18-schema-audit-nexora.md) | 27 model của dự án cũ và cách tối ưu lại ở bản này |
| [Đối chiếu API và bản đồ nâng cấp](nexora-parity/2026-07-19-api-parity-upgrade-map.md) | Khoảng 64 endpoint còn thiếu, 14 nâng cấp, 10 khác biệt schema |
| [Đối chiếu hạ tầng](nexora-parity/2026-07-19-infra-parity-nexora.md) | 8 lỗ hổng hạ tầng mà bản đếm endpoint bỏ sót |
| [Quét sâu dự án cũ](nexora-parity/2026-07-19-nexora-deep-sweep.md) | Bảng theo dõi A1–A11 và các quy tắc nghiệp vụ của dự án cũ |
| [Kiểm kê biến môi trường](nexora-parity/2026-07-19-env-keys-inventory.md) | Biến nào đã có, biến nào còn thiếu ở thời điểm 19/07/2026 |
| [Rà toàn diện trước đợt API khách thứ hai](nexora-parity/2026-07-21-full-parity-sweep-pre-p3ab.md) | 7 vùng, rà song song trước giai đoạn P3a-B |
| [Đối chiếu đợt API khách thứ hai](nexora-parity/2026-07-21-p3a-b-parity-recheck.md) | Danh sách yêu thích, câu hỏi của khách, bản tin |
| [Độ sẵn sàng của backend](nexora-parity/2026-07-22-backend-readiness-vs-nexora.md) | Căn cứ để quyết định bắt đầu làm web |
| [Đối chiếu trang tour](nexora-parity/2026-07-27-tours-parity-nexora.md) | Trang danh sách và trang chi tiết tour |
| [Đối chiếu tầng dữ liệu web](nexora-parity/2026-07-31-web-data-layer-parity-nexora.md) | Nền của [ADR-0016](../adr/0016-web-data-layer.md) |
| [Khảo sát trang quản trị của dự án cũ](nexora-parity/2026-08-20-admin-parity-nexora.md) | Mở đầu giai đoạn trang quản trị (P4); các ADR về admin sau này còn trích |

Các báo cáo tiến độ và ba đợt rà tài liệu trước đây từng nằm ở `progress/`; thư
mục này đã gỡ ngày 26/10/2026 vì CHANGELOG đã kể lại đủ. Bản cũ xem trong
[lịch sử git](https://github.com/yurivolkov21/Tourism-Platform-V2/tree/6785326e69949d4ef566c5eaf7c3eaa3706859c8/docs/analysis/progress).
