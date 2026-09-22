-- The quotation reference becomes QUO-YYYYMMDD-0001: the day it was made and that day's counter.
-- Existing quotations keep their internal number; their date is the day they were created (Asia/Dubai) and their counter
-- follows the old numbering order within that day. Revisions of one quotation share both.

ALTER TABLE "quotations" ADD COLUMN "quote_date" DATE, ADD COLUMN "quote_seq" INTEGER;

-- Backfill. The guard trigger refuses any edit to an issued quotation, so it is paused for this one statement
-- (only the two new columns are set; nothing a customer saw changes).
ALTER TABLE "quotations" DISABLE TRIGGER quotations_guard;
WITH base AS (
  SELECT number, (MIN(created_at) AT TIME ZONE 'Asia/Dubai')::date AS d FROM "quotations" GROUP BY number
), seq AS (
  SELECT number, d, ROW_NUMBER() OVER (PARTITION BY d ORDER BY number) AS s FROM base
)
UPDATE "quotations" q SET quote_date = seq.d, quote_seq = seq.s FROM seq WHERE q.number = seq.number;
ALTER TABLE "quotations" ENABLE TRIGGER quotations_guard;

ALTER TABLE "quotations" ALTER COLUMN "quote_date" SET NOT NULL, ALTER COLUMN "quote_seq" SET NOT NULL;
ALTER TABLE "quotations" ADD CONSTRAINT quotations_quote_seq_positive CHECK (quote_seq >= 1);
CREATE UNIQUE INDEX "quotations_quote_date_quote_seq_revision_key" ON "quotations"("quote_date", "quote_seq", "revision");
