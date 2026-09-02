-- AlterEnum
-- SKIPPED: worker cố ý không gửi (người nhận newsletter đã huỷ đăng ký) — tách
-- khỏi SENT để "email đã giao" chỉ đếm email Resend thật sự nhận (review F7).
ALTER TYPE "OutboxStatus" ADD VALUE 'SKIPPED';
