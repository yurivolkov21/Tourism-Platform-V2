-- AlterTable
ALTER TABLE "review_moderation_events" ADD COLUMN     "to_rejected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" UUID;

-- CreateIndex
CREATE INDEX "reviews_is_approved_rejected_at_created_at_id_idx" ON "reviews"("is_approved", "rejected_at", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ADR-0031 §1 — hai trục, và bất biến giữa chúng do DB canh chứ không do code
-- nhớ: `is_approved` trả lời "có đang trên site không", `rejected_at` trả lời
-- "đã có phán quyết chung cuộc chưa". Một review vừa đang đăng vừa bị bác là
-- một trạng thái không có nghĩa, và nó chỉ ra đời từ một nhánh code quên xoá
-- `rejected_at` lúc duyệt lại — đúng loại lỗi mà một CHECK bắt được ngay.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_verdict_shape" CHECK (
  NOT (is_approved AND rejected_at IS NOT NULL)
);

-- Ai bác thì phải bác LÚC NÀO: `rejected_by` không có `rejected_at` là một dấu
-- vết nửa vời, và mọi phép suy trạng thái dưới đây đều đọc `rejected_at`.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rejected_pair" CHECK (
  rejected_by IS NULL OR rejected_at IS NOT NULL
);
