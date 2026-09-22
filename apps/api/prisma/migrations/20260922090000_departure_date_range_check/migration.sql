-- Chuyến khởi hành: ngày về không được trước ngày đi.
--
-- Vì sao cần ở tầng DB chứ không chỉ ở API: `cancellationDeadline` suy ra luật
-- `N` từ ĐỘ DÀI chuyến (ADR-0041 §2), nên một hàng ngược ngày sinh ra độ dài âm
-- và `tripLengthDays` ném `RangeError`. Hàm đó được gọi cho MỌI hàng ở
-- `admin.departures.list` và ở `catalog.getTourBySlug`, nên đúng một hàng hỏng
-- sẽ 500 cả trang quản lý chuyến — kể cả chính cái form dùng để sửa nó — và kéo
-- sập luôn trang tour công khai.
--
-- Nợ này được ghi đích danh cho P4e-1 trong
-- `libs/shared/contract/src/schemas/refund-policy.ts`.
--
-- Bằng nhau là HỢP LỆ: tour trong ngày có ngày đi trùng ngày về.
ALTER TABLE tour_departures
  ADD CONSTRAINT departures_date_range CHECK (end_date >= start_date);
