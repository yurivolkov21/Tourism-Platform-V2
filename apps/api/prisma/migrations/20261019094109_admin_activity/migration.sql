-- Nhật ký thao tác admin (ADR-0061). Một bảng mới, chỉ THÊM — code cũ chạy được trên schema
-- mới, nên migration đi trước code được.
--
-- Mỗi dòng là một lệnh ghi admin thành công hoặc một lượt xuất Excel. Người làm và nhãn đối tượng
-- là bản chụp lúc ghi. `actor_id` SET NULL — dòng sống tiếp khi tài khoản người làm biến mất (chỉ
-- có ở TRUNCATE của test và script reset; luồng khách tự xoá là tombstone, giữ hàng). Không thủ
-- tục nào sửa hay xoá dòng.

-- CreateTable
CREATE TABLE "admin_activity" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_label" VARCHAR(320) NOT NULL,
    "actor_role" "UserRole" NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "area" VARCHAR(32) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" VARCHAR(200),
    "target_label" VARCHAR(200),
    "details" JSONB,

    CONSTRAINT "admin_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_activity_created_at_idx" ON "admin_activity"("created_at");

-- CreateIndex
CREATE INDEX "admin_activity_actor_id_created_at_idx" ON "admin_activity"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_activity_area_created_at_idx" ON "admin_activity"("area", "created_at");

-- AddForeignKey
ALTER TABLE "admin_activity" ADD CONSTRAINT "admin_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS backstop như mọi bảng (default deny, KHÔNG policy — API nối bằng role chủ bảng nên
-- bypass; đây là lưới cho đường anon/direct). `scripts/check-rls.sh` canh trong CI.
ALTER TABLE admin_activity ENABLE ROW LEVEL SECURITY;
