-- Sổ của một lượt CÔNG TY huỷ chuyến (F13, ADR-0041 §6).
--
-- Vì sao cần ở cấp CHUYẾN chứ không chỉ ở từng booking: lý do và người quyết
-- đã được chép xuống `cancellation_requests` của mỗi khách, nhưng một chuyến
-- KHÔNG có khách nào thì không để lại vết gì cả — và đó lại là ca hay gặp
-- nhất khi dọn lịch. Ba cột này là nơi duy nhất trả lời "ai huỷ, khi nào, vì
-- sao" cho chính cái chuyến ấy.
--
-- Hệ quả thứ hai, quan trọng không kém: hoàn tiền đi qua hàng đợi, và một job
-- đẩy hỏng (worker chưa đăng ký, pg-boss lỗi) sẽ để lại booking đã trả tiền
-- trên một chuyến đã huỷ mà không ai hoàn. Lượt quét `booking-sweep` dọn nốt
-- chúng, nhưng nó cần biết ghi `decided_by` là ai — `cancelled_by` chính là
-- câu trả lời đó.
--
-- `cancelled_by` CỐ Ý KHÔNG có khoá ngoại tới `users`, và đây là hai lý do —
-- cái thứ hai đo được bằng test chứ không phải suy đoán:
--
--   ① Một dấu vết kiểm toán phải sống lâu hơn thứ nó trỏ tới. Khoá ngoại buộc
--      ta chọn giữa `ON DELETE SET NULL` (xoá tài khoản admin là XOÁ LUÔN vết
--      họ từng huỷ chuyến nào) và `RESTRICT` (không xoá được tài khoản nữa).
--      Cả hai đều sai với một cột chỉ để trả lời "ai đã quyết".
--   ② `TRUNCATE users CASCADE` sẽ kéo theo MỌI bảng có khoá ngoại trỏ tới
--      `users` — và `tour_departures` là bảng catalogue, không phải bảng của
--      người dùng. Thêm khoá ngoại vào đây làm 25 integration test đỏ ngay
--      lượt chạy đầu: lịch chạy biến mất giữa chừng nên `POST /api/bookings`
--      trả `DEPARTURE_NOT_AVAILABLE`. Giữ catalogue tách khỏi identity.
ALTER TABLE tour_departures
  ADD COLUMN cancelled_at   TIMESTAMP(3),
  ADD COLUMN cancelled_by   UUID,
  ADD COLUMN cancel_reason  TEXT;

-- Lượt quét dọn hoàn tiền sót chỉ hỏi đúng một câu: chuyến nào đã huỷ mà còn
-- booking sống. Index riêng phần vì `CANCELLED` là thiểu số.
CREATE INDEX tour_departures_cancelled_idx
  ON tour_departures (status)
  WHERE status = 'CANCELLED';
