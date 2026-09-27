-- AlterTable
ALTER TABLE "products" ADD COLUMN     "model_key" TEXT;

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "attribute_key" TEXT NOT NULL,
    "raw_value" TEXT NOT NULL,
    "value_text" TEXT,
    "value_num" DECIMAL(12,3),
    "value_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unit" TEXT,
    "confidence" "ExtractionConfidence" NOT NULL,
    "source" "RequirementSource" NOT NULL,
    "source_broadcast_item_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),
    "retracted_by_id" UUID,
    "retraction_reason" TEXT,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_attributes_product_id_idx" ON "product_attributes"("product_id");

-- CreateIndex
CREATE INDEX "product_attributes_attribute_key_value_num_idx" ON "product_attributes"("attribute_key", "value_num");

-- CreateIndex
CREATE INDEX "product_attributes_attribute_key_value_text_idx" ON "product_attributes"("attribute_key", "value_text");

-- CreateIndex
CREATE INDEX "products_model_key_idx" ON "products"("model_key");

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_source_broadcast_item_id_fkey" FOREIGN KEY ("source_broadcast_item_id") REFERENCES "broadcast_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_retracted_by_id_fkey" FOREIGN KEY ("retracted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints -----------------------------------------------------------
ALTER TABLE product_attributes
  ADD CONSTRAINT product_attributes_key_format CHECK (attribute_key ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT product_attributes_raw_not_blank CHECK (length(btrim(raw_value)) > 0),
  ADD CONSTRAINT product_attributes_retraction_all_or_none CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL)),
  -- exactly one kind of value
  ADD CONSTRAINT product_attributes_one_value CHECK (
    (value_text IS NOT NULL)::int + (value_num IS NOT NULL)::int + (cardinality(coalesce(value_list, '{}')) > 0)::int = 1
  );

-- One ACTIVE value per attribute of a product -----------------------------------
CREATE UNIQUE INDEX product_attributes_one_active_per_key
  ON product_attributes (product_id, attribute_key) WHERE retracted_at IS NULL;

-- Append-only: an attribute is retracted, never edited or deleted ---------------
CREATE FUNCTION guard_product_attribute() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: an attribute is retracted, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.retracted_at IS NOT NULL THEN
    RAISE EXCEPTION 'attribute % is already retracted and cannot change', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason')
     IS DISTINCT FROM (to_jsonb(OLD) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason') THEN
    RAISE EXCEPTION 'only the retraction columns of % may be updated', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER product_attributes_guard
  BEFORE UPDATE OR DELETE ON product_attributes FOR EACH ROW EXECUTE FUNCTION guard_product_attribute();
