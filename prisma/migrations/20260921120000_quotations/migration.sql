-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "enquiry_id" UUID NOT NULL,
    "customer_id" UUID,
    "customer_name" TEXT,
    "contact_name" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency_code" CHAR(3) NOT NULL DEFAULT 'AED',
    "vat_percent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "valid_until" DATE,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "notes" TEXT,
    "issued_at" TIMESTAMPTZ(3),
    "issued_by_id" UUID,
    "superseded_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_lines" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "enquiry_item_id" UUID,
    "description" TEXT NOT NULL,
    "part_number" TEXT,
    "quantity" INTEGER,
    "unit_price" DECIMAL(14,2),
    "markup_percent" DECIMAL(7,2),
    "cost_price_observation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotations_enquiry_id_idx" ON "quotations"("enquiry_id");

-- CreateIndex
CREATE INDEX "quotations_status_updated_at_idx" ON "quotations"("status", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_number_revision_key" ON "quotations"("number", "revision");

-- CreateIndex
CREATE INDEX "quotation_lines_enquiry_item_id_idx" ON "quotation_lines"("enquiry_item_id");

-- CreateIndex
CREATE INDEX "quotation_lines_cost_price_observation_id_idx" ON "quotation_lines"("cost_price_observation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_lines_quotation_id_position_key" ON "quotation_lines"("quotation_id", "position");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_enquiry_item_id_fkey" FOREIGN KEY ("enquiry_item_id") REFERENCES "enquiry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_cost_price_observation_id_fkey" FOREIGN KEY ("cost_price_observation_id") REFERENCES "price_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints -----------------------------------------------------------
ALTER TABLE quotations
  ADD CONSTRAINT quotations_revision_positive CHECK (revision >= 1),
  ADD CONSTRAINT quotations_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT quotations_vat_range CHECK (vat_percent >= 0 AND vat_percent <= 100),
  -- A draft has not been issued; everything else has. Issuer and time go together. Superseded has its time.
  ADD CONSTRAINT quotations_issue_pair CHECK ((issued_at IS NULL) = (issued_by_id IS NULL)),
  ADD CONSTRAINT quotations_draft_not_issued CHECK ((status = 'DRAFT') = (issued_at IS NULL)),
  ADD CONSTRAINT quotations_superseded_time CHECK ((status = 'SUPERSEDED') = (superseded_at IS NOT NULL));

ALTER TABLE quotation_lines
  ADD CONSTRAINT quotation_lines_quantity_positive CHECK (quantity IS NULL OR quantity > 0),
  ADD CONSTRAINT quotation_lines_price_not_negative CHECK (unit_price IS NULL OR unit_price >= 0),
  ADD CONSTRAINT quotation_lines_markup_floor CHECK (markup_percent IS NULL OR markup_percent >= -100),
  ADD CONSTRAINT quotation_lines_description_present CHECK (btrim(description) <> '');

-- One draft per enquiry -------------------------------------------------------
CREATE UNIQUE INDEX quotations_one_draft_per_enquiry ON quotations (enquiry_id) WHERE status = 'DRAFT';

-- A quotation is editable while DRAFT, frozen once ISSUED (it can only become SUPERSEDED), and never deleted -----------------
CREATE FUNCTION guard_quotation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: a quotation is issued and superseded, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'a quotation starts as a draft' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE. These never change.
  IF (to_jsonb(NEW) - 'status' - 'issued_at' - 'issued_by_id' - 'superseded_at' - 'updated_at' - 'customer_id' - 'customer_name' - 'contact_name'
        - 'currency_code' - 'vat_percent' - 'valid_until' - 'payment_terms' - 'delivery_terms' - 'notes' )
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'issued_at' - 'issued_by_id' - 'superseded_at' - 'updated_at' - 'customer_id' - 'customer_name' - 'contact_name'
        - 'currency_code' - 'vat_percent' - 'valid_until' - 'payment_terms' - 'delivery_terms' - 'notes' ) THEN
    RAISE EXCEPTION 'the number, revision, enquiry and creator of a quotation cannot change' USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'quotation % is superseded and cannot change', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'ISSUED' THEN
    IF NEW.status <> 'SUPERSEDED' THEN
      RAISE EXCEPTION 'quotation % is issued: the only change allowed is to supersede it', OLD.id USING ERRCODE = 'restrict_violation';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'superseded_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'superseded_at' - 'updated_at') THEN
      RAISE EXCEPTION 'an issued quotation cannot be edited' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- OLD is a DRAFT: it may stay a draft or be issued, never superseded directly.
  IF NEW.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'only an issued quotation can be superseded' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.status = 'ISSUED' THEN
    IF NEW.customer_name IS NULL OR btrim(NEW.customer_name) = '' THEN
      RAISE EXCEPTION 'a quotation needs a customer name before it is issued' USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.valid_until IS NULL THEN
      RAISE EXCEPTION 'a quotation needs a valid-until date before it is issued' USING ERRCODE = 'restrict_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM quotation_lines l WHERE l.quotation_id = NEW.id) THEN
      RAISE EXCEPTION 'a quotation needs at least one line before it is issued' USING ERRCODE = 'restrict_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM quotation_lines l WHERE l.quotation_id = NEW.id AND (l.quantity IS NULL OR l.unit_price IS NULL)) THEN
      RAISE EXCEPTION 'every line needs a quantity and a price before the quotation is issued' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotations_guard
  BEFORE INSERT OR UPDATE OR DELETE ON quotations FOR EACH ROW EXECUTE FUNCTION guard_quotation();

-- Lines can change only while their quotation is a draft; a line's requirement must belong to the quotation's enquiry -----------------
CREATE FUNCTION guard_quotation_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_id uuid;
  parent_status "QuotationStatus";
  parent_enquiry uuid;
  item_enquiry uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.quotation_id IS DISTINCT FROM OLD.quotation_id THEN
    RAISE EXCEPTION 'a quotation line cannot move to another quotation' USING ERRCODE = 'restrict_violation';
  END IF;

  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.quotation_id ELSE NEW.quotation_id END;
  SELECT status, enquiry_id INTO parent_status, parent_enquiry FROM quotations WHERE id = parent_id;
  IF parent_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'lines of an issued quotation cannot be added, changed or removed' USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.enquiry_item_id IS NOT NULL THEN
    SELECT enquiry_id INTO item_enquiry FROM enquiry_items WHERE id = NEW.enquiry_item_id;
    IF item_enquiry IS DISTINCT FROM parent_enquiry THEN
      RAISE EXCEPTION 'the requirement must belong to the quotation''s enquiry' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotation_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_lines FOR EACH ROW EXECUTE FUNCTION guard_quotation_line();
