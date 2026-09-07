-- ADR-0030 AMEND 2 (vòng vá review W2): lý do của refund thiện chí là LƯỚI thay
-- bảng bậc (AMEND 1) nhưng bản đầu chỉ sống trong payload outbox — bị purge sau
-- 30 ngày, và bị in nguyên vào email khách. Nay lý do NỘI BỘ nằm trên chính
-- dòng sổ (nullable: row cũ + auto-refund không có), không purge, không gửi khách.
ALTER TABLE "refunds" ADD COLUMN "reason" VARCHAR(500);
