-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "author" VARCHAR(200),
ADD COLUMN     "license" VARCHAR(60),
ADD COLUMN     "license_url" VARCHAR(300),
ADD COLUMN     "source_url" VARCHAR(500);
