-- P6 trợ lý AI tư vấn tour (ADR-0050 và AMEND 1, spec §2f). Chỉ THÊM cột và index, mọi
-- cột đều nullable — code cũ chạy được trên schema mới, nên migration đi trước code được.
--
-- ① `chat_conversations.enquiry_id`: enquiry đã gửi qua chat, mỗi hội thoại tối đa một
--    (unique). Enquiry có hạn lưu riêng nên khoá ngoại là `ON DELETE SET NULL`.
-- ② `chat_conversations.turn_started_at`: cột giữ lượt. Khác null là có lượt đang chạy;
--    lượt mới chỉ chiếm được khi cột trống hoặc đã giữ quá 2 phút, không thì 409.
-- ③ `chat_messages.input_tokens`, `output_tokens`: token của lượt, chỉ tin trả lời có.
--    Trần chi phí ngày cộng hai cột này theo `created_at`, nên thêm index cột ấy.
--
-- Hai bảng chat có từ migration `init`, nhưng trước P6 không có code nào ghi vào chúng;
-- thêm cột không phải backfill.

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "enquiry_id" UUID,
ADD COLUMN     "turn_started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "output_tokens" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_enquiry_id_key" ON "chat_conversations"("enquiry_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
