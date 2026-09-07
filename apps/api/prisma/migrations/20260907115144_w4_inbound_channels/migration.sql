-- W4 "kênh vào & email đi ra" (ADR-0039 + ADR-0032 AMEND 1) — MỘT migration
-- gom mọi cột/bảng của đợt: consent hai bước + welcome một lần (subscribers),
-- backoff outbox, suppression từ Resend, retention enquiry + user_id,
-- reviews.retracted_at. CHƯA deploy Supabase — deploy lúc merge (nếp W1/W2).

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "anonymized_at" TIMESTAMP(3),
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "outbox" ADD COLUMN     "next_attempt_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "retracted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "welcome_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "email" CITEXT NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "enquiries_user_id_idx" ON "enquiries"("user_id");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill MỘT LẦN (ADR-0039 §2): người đã subscribe TRƯỚC W4 được coi là đã
-- consent theo luật cũ (một bước — họ đã nhận welcome), confirmed_at lấy đúng
-- mốc created_at. Đây là quyết định biên tập ghi tại chỗ, không phải luật
-- chạy lại; subscriber mới sau W4 đi qua double opt-in thật.
UPDATE "subscribers" SET "confirmed_at" = "created_at" WHERE "confirmed_at" IS NULL;

-- Cùng lý do: mọi subscriber hiện hữu đã nhận welcome theo dedupeKey
-- newsletter-welcome:<email> — đánh dấu để E2 không gửi lại thư đầu lần nữa.
UPDATE "subscribers" SET "welcome_sent_at" = "created_at" WHERE "welcome_sent_at" IS NULL;

-- RLS backstop (nếp hardening 18/07 + W2): bảng mới bật ngay trong CÙNG
-- migration — scripts/check-rls.sh trong CI đỏ nếu quên. Default deny, KHÔNG
-- policy: API nối bằng role chủ bảng nên bypass; đây là lưới cho đường
-- anon/direct.
ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;
