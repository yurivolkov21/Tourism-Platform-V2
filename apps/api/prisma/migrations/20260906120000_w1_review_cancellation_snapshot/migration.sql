-- ADR-0029 AMEND 6: chụp badge free-cancellation của tour lúc khách GỬI yêu cầu
-- huỷ — mức chính sách khách thấy là mức admin sẽ duyệt, sửa tour sau đó không
-- làm khách rớt bậc. Nullable: row cũ trước migration rơi về badge hiện tại.
ALTER TABLE "cancellation_requests" ADD COLUMN "free_cancellation_days" INTEGER;

-- Backfill (vòng vá review 06/09): trước W1 service trim rồi ghi, nên DB có thể
-- chứa reason rỗng — output contract đòi min(1) nên một row như vậy làm cả
-- hàng đợi duyệt huỷ 500. Row mới đã bị contract chặn; row cũ nhận một câu
-- trung tính thay vì chuỗi rỗng.
UPDATE "cancellation_requests" SET "reason" = 'No reason given' WHERE btrim("reason") = '';
