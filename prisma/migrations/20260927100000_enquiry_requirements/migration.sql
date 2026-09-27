-- CreateEnum
CREATE TYPE "RequirementOperator" AS ENUM ('EQUALS', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL', 'IN', 'BETWEEN', 'CONTAINS');

-- CreateEnum
CREATE TYPE "RequirementImportance" AS ENUM ('MUST', 'SHOULD', 'NICE');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('PARSER', 'AI', 'HUMAN');

-- CreateTable
CREATE TABLE "enquiry_requirements" (
    "id" UUID NOT NULL,
    "enquiry_item_id" UUID NOT NULL,
    "attribute_key" TEXT NOT NULL,
    "operator" "RequirementOperator" NOT NULL,
    "importance" "RequirementImportance" NOT NULL DEFAULT 'MUST',
    "raw_value" TEXT NOT NULL,
    "value_text" TEXT,
    "value_num" DECIMAL(12,3),
    "value_num_max" DECIMAL(12,3),
    "value_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unit" TEXT,
    "confidence" "ExtractionConfidence" NOT NULL,
    "source" "RequirementSource" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),
    "retracted_by_id" UUID,
    "retraction_reason" TEXT,

    CONSTRAINT "enquiry_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiry_requirements_enquiry_item_id_idx" ON "enquiry_requirements"("enquiry_item_id");

-- AddForeignKey
ALTER TABLE "enquiry_requirements" ADD CONSTRAINT "enquiry_requirements_enquiry_item_id_fkey" FOREIGN KEY ("enquiry_item_id") REFERENCES "enquiry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_requirements" ADD CONSTRAINT "enquiry_requirements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_requirements" ADD CONSTRAINT "enquiry_requirements_retracted_by_id_fkey" FOREIGN KEY ("retracted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints -----------------------------------------------------------
ALTER TABLE enquiry_requirements
  ADD CONSTRAINT enquiry_requirements_key_format CHECK (attribute_key ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT enquiry_requirements_raw_not_blank CHECK (length(btrim(raw_value)) > 0),
  ADD CONSTRAINT enquiry_requirements_retraction_all_or_none CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

-- The value columns must be exactly the ones the operator needs.
ALTER TABLE enquiry_requirements
  ADD CONSTRAINT enquiry_requirements_value_shape CHECK (
    CASE operator
      WHEN 'EQUALS' THEN num_nonnulls(value_text, value_num) = 1 AND value_num_max IS NULL AND cardinality(coalesce(value_list, '{}')) = 0
      WHEN 'GREATER_THAN_OR_EQUAL' THEN value_num IS NOT NULL AND value_text IS NULL AND value_num_max IS NULL AND cardinality(coalesce(value_list, '{}')) = 0
      WHEN 'LESS_THAN_OR_EQUAL' THEN value_num IS NOT NULL AND value_text IS NULL AND value_num_max IS NULL AND cardinality(coalesce(value_list, '{}')) = 0
      WHEN 'BETWEEN' THEN value_num IS NOT NULL AND value_num_max IS NOT NULL AND value_num <= value_num_max AND value_text IS NULL AND cardinality(coalesce(value_list, '{}')) = 0
      WHEN 'IN' THEN cardinality(coalesce(value_list, '{}')) >= 1 AND value_text IS NULL AND value_num IS NULL AND value_num_max IS NULL
      WHEN 'CONTAINS' THEN value_text IS NOT NULL AND value_num IS NULL AND value_num_max IS NULL AND cardinality(coalesce(value_list, '{}')) = 0
    END
  );

-- At most one ACTIVE requirement per attribute of an item ---------------------
CREATE UNIQUE INDEX enquiry_requirements_one_active_per_key
  ON enquiry_requirements (enquiry_item_id, attribute_key) WHERE retracted_at IS NULL;

-- Append-only: a requirement is retracted, never edited or deleted ------------
CREATE FUNCTION guard_enquiry_requirement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: a requirement is retracted, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.retracted_at IS NOT NULL THEN
    RAISE EXCEPTION 'requirement % is already retracted and cannot change', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason')
     IS DISTINCT FROM (to_jsonb(OLD) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason') THEN
    RAISE EXCEPTION 'only the retraction columns of % may be updated', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enquiry_requirements_guard
  BEFORE UPDATE OR DELETE ON enquiry_requirements FOR EACH ROW EXECUTE FUNCTION guard_enquiry_requirement();
