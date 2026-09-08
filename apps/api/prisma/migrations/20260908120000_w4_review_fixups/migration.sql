-- Vòng vá review W4 (08/09/2026) — sửa dữ liệu + bất biến còn thiếu sau
-- migration 20260907115144_w4_inbound_channels. Migration là bản ghi bất biến:
-- KHÔNG khai trạng thái deploy ở đây (trạng thái sống ở docs/CHANGELOG.md).

-- 1. Backfill W4 đặt confirmed_at = created_at cho MỌI row, kể cả người đã
--    unsubscribe → tập "đã xác nhận × đã huỷ" mà một campaign lọc theo
--    confirmed_at sẽ gửi tới người đã rút consent. Bỏ mốc xác nhận của đúng
--    những row backfill (confirmed_at = created_at) đang huỷ; row xác nhận
--    thật sau W4 (mốc khác created_at) không đụng.
UPDATE "subscribers" SET "confirmed_at" = NULL
WHERE "unsubscribed_at" IS NOT NULL AND "confirmed_at" = "created_at";

-- 2. Bất biến trục 3 (ADR-0032 AMEND 1, W4 U2): review đã rút KHÔNG thể còn
--    trên site — cùng khuôn reviews_verdict_shape (retract() ghi
--    is_approved=false cùng lệnh; CHECK canh mọi đường ghi tương lai).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_retracted_shape" CHECK (
  NOT (is_approved AND retracted_at IS NOT NULL)
);

-- 3. Tab "Retracted" của hàng đợi admin lọc retracted_at IS NOT NULL, sort
--    created_at desc, id desc — cùng khuôn index tab Pending/Approved.
CREATE INDEX "reviews_retracted_at_created_at_id_idx" ON "reviews"("retracted_at", "created_at" DESC, "id" DESC);
