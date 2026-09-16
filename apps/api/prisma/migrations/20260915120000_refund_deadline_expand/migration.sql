-- Hoàn tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2) — migration MỞ RỘNG
-- M1: chỉ thêm và nới, code đang chạy không hỏng. Hai cột free_cancellation_days
-- xoá ở migration M2 riêng, sau khi code mới đã sống.
-- Migration là bản ghi bất biến: KHÔNG khai trạng thái deploy ở đây (trạng thái
-- sống ở docs/CHANGELOG.md).

-- 1. Email khi khách tự huỷ. Giá trị mới KHÔNG được dùng trong cùng migration:
--    Postgres cấm dùng giá trị enum vừa ADD VALUE trước khi giao dịch commit.
ALTER TYPE "EmailType" ADD VALUE 'BOOKING_CANCELLED';

-- 2. Khách huỷ không bắt buộc ghi lý do; các dòng cũ giữ nguyên lý do đã có.
ALTER TABLE "cancellation_requests" ALTER COLUMN "reason" DROP NOT NULL;

-- 3. Ghim search_path của trigger function tổng hoàn (ADR-0009), đóng cảnh báo
--    function_search_path_mutable của linter Supabase — mục còn treo ghi ở
--    docs/conventions/supabase-data-api-surface.md.
ALTER FUNCTION public.refunds_sum_within_total() SET search_path = public, pg_temp;
