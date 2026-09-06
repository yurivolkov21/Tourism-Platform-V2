-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "checkout_session_expires_at" TIMESTAMP(3),
ADD COLUMN     "checkout_session_url" VARCHAR(2048);

-- AlterTable
ALTER TABLE "payment_events" ADD COLUMN     "note" VARCHAR(500);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "provider_payment_id" VARCHAR(255);
