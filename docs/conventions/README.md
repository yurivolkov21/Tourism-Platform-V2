# Quy ước

Mỗi file trong thư mục này là một luật còn hiệu lực khi viết code, kèm lý do và
cách kiểm tra. Khác với [handoff/](../handoff/README.md): luật thì áp dụng lâu dài,
còn tài liệu bàn giao chỉ dùng cho một đợt dựng màn. Bản đồ chung của tài liệu ở
[../README.md](../README.md).

| Tài liệu | Nội dung |
| --- | --- |
| [booking-states](booking-states.md) | Sáu cách một đơn kết thúc, và vì sao tiền được ghi ở sổ hoàn tiền còn ghế được ghi ở trạng thái đơn |
| [outbox-dedupe-key](outbox-dedupe-key.md) | Cách đặt khoá chống gửi trùng cho từng loại email |
| [read-then-write-races](read-then-write-races.md) | Bẫy đọc rồi ghi khi nhiều người ghi cùng lúc dưới Read Committed, và cách khoá đúng |
| [soft-404-loading-tsx](soft-404-loading-tsx.md) | Vì sao `loading.tsx` trên route động làm trang không tồn tại trả mã 200 thay vì 404 |
| [color-system](color-system.md) | Hệ màu: tên nội bộ không được lộ ra sản phẩm, tỷ lệ phối màu, bộ phông chữ, luật vùng hero luôn tối |
| [supabase-data-api-surface](supabase-data-api-surface.md) | Những gì đã tắt trên Supabase và vì sao; đọc trước khi bật lại bất cứ thứ gì |
| [mobile-dev-loop](mobile-dev-loop.md) | Chạy thử và kiểm tra app mobile, các bẫy đã gặp, đăng nhập Google trên bản build thử |
