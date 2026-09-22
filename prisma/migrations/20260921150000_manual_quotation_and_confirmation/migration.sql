-- AlterEnum
ALTER TYPE "EvidenceChannel" ADD VALUE 'PHONE';

-- AlterEnum
ALTER TYPE "EvidenceKind" ADD VALUE 'SUPPLIER_CONFIRMATION';

-- AlterTable
ALTER TABLE "quotations" ALTER COLUMN "enquiry_id" DROP NOT NULL;

