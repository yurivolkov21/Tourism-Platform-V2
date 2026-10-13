-- P4f vùng Users (ADR-0052). Ba thay đổi, cả ba chỉ THÊM — code cũ chạy được trên
-- schema mới, nên migration đi trước code được.
--
-- ① `STAFF` nối đuôi enum `UserRole`. Owner vẫn là `ADMIN` và chỉ đến từ `ADMIN_EMAILS`
--    (SEC-1); Staff do Owner cấp trên giao diện admin.
-- ② `users.locked_at`: khác null là tài khoản bị khoá — Better Auth không tạo phiên mới
--    (hook `session.create.before`), AuthGuard trả 401 cho phiên sót. Lý do khoá KHÔNG nằm
--    ở đây mà ở `user_events.note` của dòng LOCKED: một sự thật, một chỗ.
-- ③ `user_events`: lịch sử Owner thao tác lên một tài khoản, chỉ ghi thêm. `user_id`
--    CASCADE — lịch sử đi theo tài khoản (tài khoản chỉ bị xoá hàng thật ở TRUNCATE của
--    test và script reset; luồng khách tự xoá là tombstone, giữ hàng). `actor_id` SET NULL
--    — dòng lịch sử sống tiếp khi tài khoản người làm biến mất.

-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('STAFF_GRANTED', 'STAFF_REVOKED', 'LOCKED', 'UNLOCKED', 'SESSIONS_REVOKED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locked_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "UserEventType" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_events_user_id_created_at_idx" ON "user_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS backstop như mọi bảng (default deny, KHÔNG policy — API nối bằng role chủ bảng nên
-- bypass; đây là lưới cho đường anon/direct). `scripts/check-rls.sh` canh trong CI.
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
