-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('AUTHORIZED_DISTRIBUTOR', 'DISTRIBUTOR', 'STOCKIST', 'RESELLER', 'TRADER', 'IMPORTER', 'MARKETPLACE_SELLER', 'SERVICE_PROVIDER', 'PROJECT_PARTNER');

-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SUPPLIER_BROADCAST');

-- CreateEnum
CREATE TYPE "EvidenceChannel" AS ENUM ('MANUAL_PASTE', 'WHATSAPP', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('MANUAL', 'REVIEW');

-- CreateEnum
CREATE TYPE "ItemOrigin" AS ENUM ('PARSER', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExtractionConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ItemReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "MatchBasis" AS ENUM ('PART_NUMBER', 'MODEL', 'ALIAS', 'MANUAL', 'NEW_PRODUCT');

-- CreateEnum
CREATE TYPE "VatState" AS ENUM ('INCLUDED', 'EXCLUDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LIMITED', 'AVAILABLE', 'INCOMING', 'ON_REQUEST', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "code" TEXT,
    "type" "SupplierType",
    "country" TEXT,
    "emirate" TEXT,
    "area" TEXT,
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "trn" TEXT,
    "payment_terms" TEXT,
    "credit_terms" TEXT,
    "warranty_notes" TEXT,
    "delivery_notes" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "job_title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "preferred_channel" "PreferredChannel",
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_brands" (
    "supplier_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_brands_pkey" PRIMARY KEY ("supplier_id","brand_id")
);

-- CreateTable
CREATE TABLE "supplier_categories" (
    "supplier_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("supplier_id","category_id")
);

-- CreateTable
CREATE TABLE "supplier_contact_brands" (
    "contact_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contact_brands_pkey" PRIMARY KEY ("contact_id","brand_id")
);

-- CreateTable
CREATE TABLE "supplier_contact_categories" (
    "contact_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contact_categories_pkey" PRIMARY KEY ("contact_id","category_id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" UUID,
    "category_id" UUID,
    "family" TEXT,
    "model" TEXT,
    "part_number" TEXT,
    "manufacturer_sku" TEXT,
    "description" TEXT,
    "normalized_model" TEXT,
    "normalized_part_number" TEXT,
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_aliases" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "source" "AliasSource" NOT NULL DEFAULT 'MANUAL',
    "source_broadcast_item_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_sources" (
    "id" UUID NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "channel" "EvidenceChannel" NOT NULL DEFAULT 'MANUAL_PASTE',
    "raw_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" UUID NOT NULL,
    "evidence_source_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "contact_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_items" (
    "id" UUID NOT NULL,
    "broadcast_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "source_text" TEXT NOT NULL,
    "source_line_start" INTEGER,
    "source_line_end" INTEGER,
    "origin" "ItemOrigin" NOT NULL,
    "extraction_confidence" "ExtractionConfidence",
    "extracted_data" JSONB,
    "description" TEXT,
    "brand_text" TEXT,
    "model_text" TEXT,
    "part_number" TEXT,
    "spec_text" TEXT,
    "quantity" INTEGER,
    "price_amount" DECIMAL(14,2),
    "currency_code" CHAR(3),
    "vat_state" "VatState" NOT NULL DEFAULT 'UNKNOWN',
    "stock_status" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "product_id" UUID,
    "match_basis" "MatchBasis",
    "review_status" "ItemReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMPTZ(3),
    "confirmed_by_id" UUID,
    "ignored_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "broadcast_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "contact_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "vat_state" "VatState" NOT NULL DEFAULT 'UNKNOWN',
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "evidence_source_id" UUID NOT NULL,
    "broadcast_item_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),
    "retracted_by_id" UUID,
    "retraction_reason" TEXT,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_observations" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "contact_id" UUID,
    "quantity" INTEGER,
    "status" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "evidence_source_id" UUID NOT NULL,
    "broadcast_item_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),
    "retracted_by_id" UUID,
    "retraction_reason" TEXT,

    CONSTRAINT "stock_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "brands_normalized_name_key" ON "brands"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_normalized_name_key" ON "categories"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_normalized_name_key" ON "suppliers"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_status_idx" ON "supplier_contacts"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "supplier_brands_brand_id_idx" ON "supplier_brands"("brand_id");

-- CreateIndex
CREATE INDEX "supplier_categories_category_id_idx" ON "supplier_categories"("category_id");

-- CreateIndex
CREATE INDEX "supplier_contact_brands_brand_id_idx" ON "supplier_contact_brands"("brand_id");

-- CreateIndex
CREATE INDEX "supplier_contact_categories_category_id_idx" ON "supplier_contact_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_normalized_part_number_key" ON "products"("normalized_part_number");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_normalized_model_idx" ON "products"("normalized_model");

-- CreateIndex
CREATE INDEX "products_status_is_temporary_idx" ON "products"("status", "is_temporary");

-- CreateIndex
CREATE INDEX "product_aliases_normalized_alias_idx" ON "product_aliases"("normalized_alias");

-- CreateIndex
CREATE UNIQUE INDEX "product_aliases_product_id_normalized_alias_key" ON "product_aliases"("product_id", "normalized_alias");

-- CreateIndex
CREATE INDEX "evidence_sources_content_hash_idx" ON "evidence_sources"("content_hash");

-- CreateIndex
CREATE INDEX "evidence_sources_observed_at_idx" ON "evidence_sources"("observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "broadcasts_evidence_source_id_key" ON "broadcasts"("evidence_source_id");

-- CreateIndex
CREATE INDEX "broadcasts_supplier_id_created_at_idx" ON "broadcasts"("supplier_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "broadcasts_archived_at_idx" ON "broadcasts"("archived_at");

-- CreateIndex
CREATE INDEX "broadcast_items_broadcast_id_review_status_idx" ON "broadcast_items"("broadcast_id", "review_status");

-- CreateIndex
CREATE INDEX "broadcast_items_product_id_idx" ON "broadcast_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_items_broadcast_id_position_key" ON "broadcast_items"("broadcast_id", "position");

-- CreateIndex
CREATE INDEX "price_observations_product_id_supplier_id_observed_at_idx" ON "price_observations"("product_id", "supplier_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "price_observations_supplier_id_observed_at_idx" ON "price_observations"("supplier_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "price_observations_evidence_source_id_idx" ON "price_observations"("evidence_source_id");

-- CreateIndex
CREATE INDEX "price_observations_broadcast_item_id_idx" ON "price_observations"("broadcast_item_id");

-- CreateIndex
CREATE INDEX "stock_observations_product_id_supplier_id_observed_at_idx" ON "stock_observations"("product_id", "supplier_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "stock_observations_supplier_id_observed_at_idx" ON "stock_observations"("supplier_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "stock_observations_evidence_source_id_idx" ON "stock_observations"("evidence_source_id");

-- CreateIndex
CREATE INDEX "stock_observations_broadcast_item_id_idx" ON "stock_observations"("broadcast_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_scope_type_scope_id_created_at_idx" ON "audit_logs"("scope_type", "scope_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_brands" ADD CONSTRAINT "supplier_brands_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_brands" ADD CONSTRAINT "supplier_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contact_brands" ADD CONSTRAINT "supplier_contact_brands_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contact_brands" ADD CONSTRAINT "supplier_contact_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contact_categories" ADD CONSTRAINT "supplier_contact_categories_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contact_categories" ADD CONSTRAINT "supplier_contact_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_source_broadcast_item_id_fkey" FOREIGN KEY ("source_broadcast_item_id") REFERENCES "broadcast_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_evidence_source_id_fkey" FOREIGN KEY ("evidence_source_id") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_items" ADD CONSTRAINT "broadcast_items_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_items" ADD CONSTRAINT "broadcast_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_items" ADD CONSTRAINT "broadcast_items_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_evidence_source_id_fkey" FOREIGN KEY ("evidence_source_id") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_broadcast_item_id_fkey" FOREIGN KEY ("broadcast_item_id") REFERENCES "broadcast_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_retracted_by_id_fkey" FOREIGN KEY ("retracted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_evidence_source_id_fkey" FOREIGN KEY ("evidence_source_id") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_broadcast_item_id_fkey" FOREIGN KEY ("broadcast_item_id") REFERENCES "broadcast_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_retracted_by_id_fkey" FOREIGN KEY ("retracted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Hand-written hardening (not expressible in Prisma). Source of truth: docs/architecture/DATA_MODEL.md section 5.
-- CHECK constraints, one-active-observation-per-item indexes, append-only and immutability triggers.
-- ============================================================================

-- CHECK constraints ----------------------------------------------------------
ALTER TABLE price_observations
  ADD CONSTRAINT price_observations_amount_nonneg CHECK (amount >= 0),
  ADD CONSTRAINT price_observations_currency_fmt CHECK (currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT price_observations_retraction_all_or_none
    CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

ALTER TABLE stock_observations
  ADD CONSTRAINT stock_observations_quantity_nonneg CHECK (quantity IS NULL OR quantity >= 0),
  ADD CONSTRAINT stock_observations_not_all_unknown CHECK (quantity IS NOT NULL OR status <> 'UNKNOWN'),
  ADD CONSTRAINT stock_observations_retraction_all_or_none
    CHECK ((retracted_at IS NULL) = (retracted_by_id IS NULL));

ALTER TABLE broadcast_items
  ADD CONSTRAINT broadcast_items_quantity_nonneg CHECK (quantity IS NULL OR quantity >= 0),
  ADD CONSTRAINT broadcast_items_price_nonneg CHECK (price_amount IS NULL OR price_amount >= 0),
  ADD CONSTRAINT broadcast_items_currency_fmt CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT broadcast_items_source_lines
    CHECK (source_line_start IS NULL OR source_line_end IS NULL OR source_line_end >= source_line_start),
  ADD CONSTRAINT broadcast_items_confirmed_has_product
    CHECK (review_status <> 'CONFIRMED' OR product_id IS NOT NULL),
  ADD CONSTRAINT broadcast_items_confirmed_price_has_currency
    CHECK (review_status <> 'CONFIRMED' OR price_amount IS NULL OR currency_code IS NOT NULL);

-- At most one ACTIVE observation per broadcast item ---------------------------
CREATE UNIQUE INDEX price_observations_one_active_per_item
  ON price_observations (broadcast_item_id)
  WHERE broadcast_item_id IS NOT NULL AND retracted_at IS NULL;
CREATE UNIQUE INDEX stock_observations_one_active_per_item
  ON stock_observations (broadcast_item_id)
  WHERE broadcast_item_id IS NOT NULL AND retracted_at IS NULL;

-- Append-only tables ---------------------------------------------------------
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER evidence_sources_append_only
  BEFORE UPDATE OR DELETE ON evidence_sources FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Observations: immutable except one-way retraction ---------------------------
CREATE FUNCTION guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: observations are retracted, never deleted', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.retracted_at IS NOT NULL THEN
    RAISE EXCEPTION 'observation % is already retracted and cannot change', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason')
     IS DISTINCT FROM (to_jsonb(OLD) - 'retracted_at' - 'retracted_by_id' - 'retraction_reason') THEN
    RAISE EXCEPTION 'only the retraction columns of % may be updated', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER price_observations_guard
  BEFORE UPDATE OR DELETE ON price_observations FOR EACH ROW EXECUTE FUNCTION guard_observation();
CREATE TRIGGER stock_observations_guard
  BEFORE UPDATE OR DELETE ON stock_observations FOR EACH ROW EXECUTE FUNCTION guard_observation();

-- Parser output is write-once --------------------------------------------------
CREATE FUNCTION guard_item_extracted_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.extracted_data IS NOT NULL AND NEW.extracted_data IS DISTINCT FROM OLD.extracted_data THEN
    RAISE EXCEPTION 'broadcast_items.extracted_data is write-once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER broadcast_items_extracted_data_guard
  BEFORE UPDATE ON broadcast_items FOR EACH ROW EXECUTE FUNCTION guard_item_extracted_data();
