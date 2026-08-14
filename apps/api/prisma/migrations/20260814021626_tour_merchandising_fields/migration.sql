-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "fact_difficulty_note" VARCHAR(280),
ADD COLUMN     "fact_duration_note" VARCHAR(280),
ADD COLUMN     "fact_good_for_note" VARCHAR(280),
ADD COLUMN     "fact_group_size_note" VARCHAR(280),
ADD COLUMN     "free_cancellation_days" INTEGER;
