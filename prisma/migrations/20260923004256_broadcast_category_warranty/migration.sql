-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('CARRY_IN', 'ON_SITE', 'NBD', 'RETURN_TO_BASE');

-- AlterTable
ALTER TABLE "broadcast_items" ADD COLUMN     "category_text" TEXT,
ADD COLUMN     "warranty_months" INTEGER,
ADD COLUMN     "warranty_type" "WarrantyType";

-- AlterTable
ALTER TABLE "price_observations" ADD COLUMN     "warranty_months" INTEGER,
ADD COLUMN     "warranty_type" "WarrantyType";

-- CHECK constraints
ALTER TABLE broadcast_items
  ADD CONSTRAINT broadcast_items_warranty_months_positive CHECK (warranty_months IS NULL OR warranty_months > 0);
ALTER TABLE price_observations
  ADD CONSTRAINT price_observations_warranty_months_positive CHECK (warranty_months IS NULL OR warranty_months > 0);
