-- Additive only: one new table for rough supplier-contact notes pasted into the right dock. Nothing existing is changed.

-- CreateTable
CREATE TABLE "contact_notes" (
    "id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_notes_status_created_at_idx" ON "contact_notes"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A note always has text (the service trims it; this keeps the database honest too).
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_body_not_blank" CHECK (length(btrim("body")) > 0);
