-- CreateIndex
CREATE INDEX "reviews_is_approved_created_at_id_idx" ON "reviews"("is_approved", "created_at" DESC, "id" DESC);
