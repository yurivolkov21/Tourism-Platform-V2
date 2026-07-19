/*
  Warnings:

  - Changed the type of `email` on the `enquiries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updated_at` to the `subscribers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "enquiries" DROP COLUMN "email",
ADD COLUMN     "email" CITEXT NOT NULL;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "featured_rank" INTEGER;

-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "unsubscribed_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "rating_avg" DECIMAL(2,1),
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "review_moderation_events" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "actor_id" UUID,
    "from_approved" BOOLEAN NOT NULL,
    "to_approved" BOOLEAN NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_moderation_events_review_id_created_at_idx" ON "review_moderation_events"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "enquiries_email_idx" ON "enquiries"("email");

-- AddForeignKey
ALTER TABLE "review_moderation_events" ADD CONSTRAINT "review_moderation_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_events" ADD CONSTRAINT "review_moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bất biến VERIFIED/CURATED (audit S5). Nexora chỉ có quy ước trong code:
-- VERIFIED phải đủ 3 FK, CURATED phải null cả 3 — không gì chặn dữ liệu lai.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source_shape" CHECK (
  (source = 'VERIFIED' AND tour_id IS NOT NULL AND user_id IS NOT NULL AND booking_id IS NOT NULL)
  OR
  (source = 'CURATED' AND booking_id IS NULL AND user_id IS NULL)
);

-- Rating chỉ hợp lệ trong 1..5 (đã có ở hardening-v2, nhắc lại cho rõ ràng
-- nếu migration này chạy trên DB chưa áp hardening).
-- Không lặp lại nếu constraint đã tồn tại:
DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK (rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ratingCount không âm; ratingAvg nếu có thì phải trong 1..5.
ALTER TABLE "tours" ADD CONSTRAINT "tours_rating_sane" CHECK (
  rating_count >= 0 AND (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5))
);

-- RLS cho bảng mới (nhất quán với 31 bảng còn lại).
ALTER TABLE "review_moderation_events" ENABLE ROW LEVEL SECURITY;
