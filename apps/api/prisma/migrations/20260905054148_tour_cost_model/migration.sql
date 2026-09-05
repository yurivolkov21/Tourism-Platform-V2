-- CreateEnum
CREATE TYPE "TourCostBasis" AS ENUM ('PER_PERSON', 'PER_DEPARTURE');

-- CreateEnum
CREATE TYPE "TourCostCategory" AS ENUM ('TRANSPORT', 'ACCOMMODATION', 'MEALS', 'GUIDE', 'ACTIVITIES', 'PERMITS', 'INSURANCE', 'OTHER');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cost_per_person" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "tour_departures" ADD COLUMN     "fixed_cost_amount" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "tour_cost_items" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "category" "TourCostCategory" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "basis" "TourCostBasis" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_cost_items_tour_id_sort_order_idx" ON "tour_cost_items"("tour_id", "sort_order");

-- AddForeignKey
ALTER TABLE "tour_cost_items" ADD CONSTRAINT "tour_cost_items_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
