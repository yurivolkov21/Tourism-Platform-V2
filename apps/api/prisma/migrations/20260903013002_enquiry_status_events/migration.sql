-- CreateTable
CREATE TABLE "enquiry_status_events" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "admin_id" UUID,
    "from_status" "EnquiryStatus" NOT NULL,
    "to_status" "EnquiryStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiry_status_events_enquiry_id_created_at_idx" ON "enquiry_status_events"("enquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "enquiry_status_events_to_status_created_at_idx" ON "enquiry_status_events"("to_status", "created_at");

-- AddForeignKey
ALTER TABLE "enquiry_status_events" ADD CONSTRAINT "enquiry_status_events_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_status_events" ADD CONSTRAINT "enquiry_status_events_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
