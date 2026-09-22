-- CreateTable
CREATE TABLE "procurement_decisions" (
    "id" UUID NOT NULL,
    "enquiry_item_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "price_observation_id" UUID,
    "stock_observation_id" UUID,
    "note" TEXT,
    "decided_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),
    "retracted_by_id" UUID,
    "retraction_reason" TEXT,

    CONSTRAINT "procurement_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_decisions_enquiry_item_id_idx" ON "procurement_decisions"("enquiry_item_id");

-- CreateIndex
CREATE INDEX "procurement_decisions_supplier_id_idx" ON "procurement_decisions"("supplier_id");

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_enquiry_item_id_fkey" FOREIGN KEY ("enquiry_item_id") REFERENCES "enquiry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_price_observation_id_fkey" FOREIGN KEY ("price_observation_id") REFERENCES "price_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_stock_observation_id_fkey" FOREIGN KEY ("stock_observation_id") REFERENCES "stock_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_decisions" ADD CONSTRAINT "procurement_decisions_retracted_by_id_fkey" FOREIGN KEY ("retracted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint -----------------------------------------------------------
ALTER TABLE procurement_decisions
  ADD CONSTRAINT procurement_decisions_retraction_all_or_none CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

-- At most one ACTIVE decision per requirement ---------------------------------
CREATE UNIQUE INDEX procurement_decisions_one_active_per_item
  ON procurement_decisions (enquiry_item_id) WHERE retracted_at IS NULL;

-- Integrity, and immutability except one-way retraction ------------------------
CREATE FUNCTION guard_procurement_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item_enquiry uuid;
  item_product uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: a decision is retracted, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.retracted_at IS NOT NULL THEN
      RAISE EXCEPTION 'decision % is already retracted and cannot change', OLD.id USING ERRCODE = 'restrict_violation';
    END IF;
    IF (to_jsonb(NEW) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason')
       IS DISTINCT FROM (to_jsonb(OLD) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason') THEN
      RAISE EXCEPTION 'only the retraction columns of % may be updated', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT: the supplier must have been asked on the requirement's enquiry, and any observation must be that supplier's, for that product.
  SELECT enquiry_id, product_id INTO item_enquiry, item_product FROM enquiry_items WHERE id = NEW.enquiry_item_id;
  IF NOT EXISTS (SELECT 1 FROM supplier_requests r WHERE r.enquiry_id = item_enquiry AND r.supplier_id = NEW.supplier_id) THEN
    RAISE EXCEPTION 'the chosen supplier must be one of the suppliers on this enquiry' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.price_observation_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM price_observations o WHERE o.id = NEW.price_observation_id AND o.supplier_id = NEW.supplier_id AND o.product_id = item_product) THEN
    RAISE EXCEPTION 'the price must be the chosen supplier''s price for the requirement''s product' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.stock_observation_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM stock_observations o WHERE o.id = NEW.stock_observation_id AND o.supplier_id = NEW.supplier_id AND o.product_id = item_product) THEN
    RAISE EXCEPTION 'the stock must be the chosen supplier''s stock for the requirement''s product' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER procurement_decisions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON procurement_decisions FOR EACH ROW EXECUTE FUNCTION guard_procurement_decision();
