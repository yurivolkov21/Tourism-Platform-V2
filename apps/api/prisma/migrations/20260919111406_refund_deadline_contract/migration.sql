-- Hoàn tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2) — migration THU HẸP
-- M2: chạy SAU khi code mới đã sống và prod đã seed lại. Xoá hai cột badge huỷ
-- của ADR-0023 và ba loại email của luồng duyệt huỷ ADR-0029.
-- Migration là bản ghi bất biến: KHÔNG khai trạng thái deploy ở đây (trạng thái
-- sống ở docs/CHANGELOG.md).

-- 1. Hai cột badge huỷ. Không có index, FK hay CHECK nào trỏ vào chúng.
ALTER TABLE "tours" DROP COLUMN "free_cancellation_days";
ALTER TABLE "cancellation_requests" DROP COLUMN "free_cancellation_days";

-- 2. Chốt chặn: Postgres không có ALTER TYPE ... DROP VALUE, nên phải dựng lại
--    kiểu. Dựng lại mà còn dòng mang giá trị cũ thì câu USING bên dưới nổ với
--    một thông điệp khó đọc; RAISE ở đây nói thẳng phải làm gì.
DO $$
DECLARE con_lai bigint;
BEGIN
  SELECT count(*) INTO con_lai FROM "outbox"
   WHERE "type" IN ('CANCELLATION_REQUESTED', 'CANCELLATION_APPROVED', 'CANCELLATION_DENIED');
  IF con_lai > 0 THEN
    RAISE EXCEPTION
      'outbox con % dong mang EmailType cua luong duyet huy — chay lai seed hoac don cac dong do truoc khi chay M2',
      con_lai;
  END IF;
END $$;

-- 3. Dựng lại "EmailType" không còn ba giá trị ấy. Thứ tự giữ nguyên phần còn
--    lại và BOOKING_CANCELLED vẫn đứng CUỐI, khớp enum Prisma và EmailTypeSchema.
--    Cột duy nhất dùng kiểu này là "outbox"."type" (không có DEFAULT).
ALTER TYPE "EmailType" RENAME TO "EmailType_old";

CREATE TYPE "EmailType" AS ENUM (
  'BOOKING_CONFIRMATION',
  'BOOKING_REFUNDED',
  'REVIEW_APPROVED',
  'REVIEW_REJECTED',
  'ENQUIRY_RECEIVED',
  'ENQUIRY_ADMIN_ALERT',
  'NEWSLETTER_WELCOME',
  'EMAIL_CHANGED',
  'PASSWORD_RESET',
  'EMAIL_VERIFICATION',
  'EMAIL_OTP',
  'BOOKING_CANCELLED'
);

ALTER TABLE "outbox"
  ALTER COLUMN "type" TYPE "EmailType" USING ("type"::text::"EmailType");

DROP TYPE "EmailType_old";
