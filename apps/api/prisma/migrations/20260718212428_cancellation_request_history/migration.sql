-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'CANCELLATION_APPROVED';

-- DropIndex
DROP INDEX "cancellation_requests_booking_id_key";

-- CreateIndex
CREATE INDEX "cancellation_requests_booking_id_idx" ON "cancellation_requests"("booking_id");

-- D1-B (spec P2 §2, closes audit M7): cancellation_requests is APPEND-ONLY
-- history — the plain unique on booking_id above is replaced by a PARTIAL
-- unique index so at most ONE live (REQUESTED) request exists per booking
-- while DENIED/REFUNDED history rows accumulate freely. The service maps a
-- 23505 on this index to 409 ALREADY_REQUESTED (cancellations.service.ts).
CREATE UNIQUE INDEX "cancellation_requests_one_live_per_booking"
  ON "cancellation_requests"("booking_id")
  WHERE status = 'REQUESTED';
