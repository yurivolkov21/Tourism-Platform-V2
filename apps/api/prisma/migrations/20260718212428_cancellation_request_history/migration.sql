-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'CANCELLATION_APPROVED';

-- DropIndex
DROP INDEX "cancellation_requests_booking_id_key";

-- CreateIndex
CREATE INDEX "cancellation_requests_booking_id_idx" ON "cancellation_requests"("booking_id");

-- D1-B (spec P2 §2, đóng audit M7): cancellation_requests là history
-- APPEND-ONLY — unique thường trên booking_id ở trên được thay bằng một partial
-- unique index để tối đa MỘT yêu cầu live (REQUESTED) tồn tại mỗi booking, còn
-- các row history DENIED/REFUNDED cứ cộng dồn thoải mái. Service map một 23505
-- trên index này thành 409 ALREADY_REQUESTED (cancellations.service.ts).
CREATE UNIQUE INDEX "cancellation_requests_one_live_per_booking"
  ON "cancellation_requests"("booking_id")
  WHERE status = 'REQUESTED';
