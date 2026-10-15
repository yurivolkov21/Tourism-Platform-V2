-- G25 (ADR-0053 AMEND 2): khoá ngoại `tour_destinations.destination_id` đổi từ
-- `ON DELETE CASCADE` sang `ON DELETE RESTRICT`, giống `tours.category_id`.
--
-- Trước đây xoá một điểm đến còn tour trỏ vào bằng SQL tay, Prisma Studio hay một script
-- thì DB lặng lẽ gỡ liên kết và tour mất điểm đến; chốt chặn duy nhất là phép đếm dưới khoá
-- hàng của lệnh xoá ở API (ADR-0053 §3). Từ migration này DB từ chối mọi đường xoá như vậy
-- (lỗi 23503). Phía `tour_id` giữ CASCADE: xoá tour thì liên kết đi theo.
--
-- Chỉ đổi luật xoá của một khoá ngoại, không đụng dữ liệu. Khoá ngoại mới cùng cột, cùng
-- bảng đích với khoá cũ nên mọi hàng đang có đều thoả nó. Code API trước và sau G25 đều
-- chỉ xoá điểm đến khi không còn liên kết nào, nên migration lên trước hay sau API đều được.
--
-- MỘT câu `ALTER TABLE` hai mệnh đề thay cho hai câu Prisma sinh ra (DROP rồi ADD).
-- `prisma migrate deploy` không bọc file trong transaction: đo trên Postgres 17 local, câu
-- ADD hỏng thì câu DROP trước nó vẫn ăn và bảng mất hẳn khoá ngoại. Một câu thì hoặc đổi
-- trọn, hoặc không đổi gì.

ALTER TABLE "tour_destinations"
  DROP CONSTRAINT "tour_destinations_destination_id_fkey",
  ADD CONSTRAINT "tour_destinations_destination_id_fkey" FOREIGN KEY ("destination_id")
    REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
