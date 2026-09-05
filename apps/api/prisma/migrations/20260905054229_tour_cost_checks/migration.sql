-- Bất biến của mô hình giá vốn, do DB canh (ADR-0033 §2).
--
-- Migration RIÊNG chứ không nối vào `tour_cost_model` ngay trước nó: file kia
-- đã được apply, và Prisma lưu checksum từng migration — đổi một ký tự là
-- drift và `migrate dev` đòi reset cả database. Luật ấy đã ghi ở CLAUDE.md và
-- đợt này vừa dẫm phải một lần nữa.
--
-- Vì sao là CHECK chứ không phải một phép kiểm trong code: giá vốn âm không
-- có nghĩa nào, và một dấu trừ gõ nhầm sẽ làm lợi nhuận PHÌNH LÊN chứ không
-- nổ ra — đúng kiểu sai không ai soi thấy trên một tờ báo cáo. Để code nhớ hộ
-- thì sớm muộn cũng có một đường ghi quên kiểm.

ALTER TABLE "tour_cost_items" ADD CONSTRAINT "tour_cost_items_amount_nonneg"
  CHECK (amount >= 0);

-- Hai cột snapshot NULLABLE (null = chưa khai giá vốn, khác hẳn 0), nên vế
-- `IS NULL OR` là bắt buộc — thiếu nó thì CHECK từ chối mọi booking của tour
-- chưa có giá vốn.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cost_per_person_nonneg"
  CHECK (cost_per_person IS NULL OR cost_per_person >= 0);

ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_fixed_cost_nonneg"
  CHECK (fixed_cost_amount IS NULL OR fixed_cost_amount >= 0);
