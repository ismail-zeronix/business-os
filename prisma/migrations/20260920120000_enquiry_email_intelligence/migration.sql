-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'ASSIGNED', 'SOURCING', 'WAITING_SUPPLIER', 'QUOTATION_READY', 'QUOTED', 'NEGOTIATION', 'FOLLOW_UP', 'WON', 'LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "EnquiryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailSecurity" AS ENUM ('SSL_TLS', 'STARTTLS');

-- CreateEnum
CREATE TYPE "EmailBand" AS ENUM ('LIKELY', 'REVIEW', 'LOW');

-- CreateEnum
CREATE TYPE "EmailTriageStatus" AS ENUM ('NEW', 'ENQUIRY_CREATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM ('OK', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceKind" ADD VALUE 'CUSTOMER_ENQUIRY';
ALTER TYPE "EvidenceKind" ADD VALUE 'CUSTOMER_EMAIL';

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "trn" TEXT,
    "country" TEXT,
    "emirate" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "job_title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "normalized_email" TEXT,
    "preferred_channel" "PreferredChannel",
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "evidence_source_id" UUID NOT NULL,
    "customer_id" UUID,
    "contact_id" UUID,
    "requester_name" TEXT,
    "requester_email" TEXT,
    "subject" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "priority" "EnquiryPriority" NOT NULL DEFAULT 'NORMAL',
    "required_by" DATE,
    "delivery_location" TEXT,
    "blocker" TEXT,
    "next_action" TEXT,
    "assigned_to_id" UUID,
    "notes" TEXT,
    "extracted_data" JSONB,
    "archived_at" TIMESTAMPTZ(3),
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_items" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "source_text" TEXT NOT NULL,
    "source_line_start" INTEGER,
    "source_line_end" INTEGER,
    "origin" "ItemOrigin" NOT NULL,
    "extraction_confidence" "ExtractionConfidence",
    "extracted_data" JSONB,
    "description" TEXT,
    "brand_text" TEXT,
    "family_text" TEXT,
    "model_text" TEXT,
    "part_number" TEXT,
    "spec_text" TEXT,
    "quantity" INTEGER,
    "notes" TEXT,
    "product_id" UUID,
    "match_basis" "MatchBasis",
    "review_status" "ItemReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMPTZ(3),
    "confirmed_by_id" UUID,
    "ignored_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enquiry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" "EmailSecurity" NOT NULL DEFAULT 'SSL_TLS',
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "normalized_key" TEXT NOT NULL,
    "sync_from_date" TIMESTAMPTZ(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "uid_validity" BIGINT,
    "last_uid" BIGINT,
    "last_sync_at" TIMESTAMPTZ(3),
    "last_sync_status" "EmailSyncStatus",
    "last_sync_error" TEXT,
    "sync_lease_until" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "folder" TEXT NOT NULL,
    "uid" BIGINT NOT NULL,
    "uid_validity" BIGINT NOT NULL,
    "message_id" TEXT,
    "in_reply_to" TEXT,
    "references_header" TEXT,
    "from_name" TEXT,
    "from_address" TEXT,
    "to_addresses" JSONB NOT NULL,
    "cc_addresses" JSONB NOT NULL,
    "subject" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "text_body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL,
    "raw_source" BYTEA,
    "raw_size" INTEGER NOT NULL,
    "parse_error" TEXT,
    "score" INTEGER NOT NULL,
    "score_reasons" JSONB NOT NULL,
    "band" "EmailBand" NOT NULL,
    "triage_status" "EmailTriageStatus" NOT NULL DEFAULT 'NEW',
    "dismissed_at" TIMESTAMPTZ(3),
    "dismissed_by_id" UUID,
    "dismissed_reason" TEXT,
    "enquiry_id" UUID,
    "evidence_source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_normalized_name_key" ON "customers"("normalized_name");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_status_idx" ON "customer_contacts"("customer_id", "status");

-- CreateIndex
CREATE INDEX "customer_contacts_normalized_email_idx" ON "customer_contacts"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_number_key" ON "enquiries"("number");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_evidence_source_id_key" ON "enquiries"("evidence_source_id");

-- CreateIndex
CREATE INDEX "enquiries_status_last_activity_at_idx" ON "enquiries"("status", "last_activity_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_customer_id_idx" ON "enquiries"("customer_id");

-- CreateIndex
CREATE INDEX "enquiries_archived_at_idx" ON "enquiries"("archived_at");

-- CreateIndex
CREATE INDEX "enquiry_items_enquiry_id_review_status_idx" ON "enquiry_items"("enquiry_id", "review_status");

-- CreateIndex
CREATE INDEX "enquiry_items_product_id_idx" ON "enquiry_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_items_enquiry_id_position_key" ON "enquiry_items"("enquiry_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_normalized_key_key" ON "email_accounts"("normalized_key");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_enquiry_id_key" ON "email_messages"("enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_evidence_source_id_key" ON "email_messages"("evidence_source_id");

-- CreateIndex
CREATE INDEX "email_messages_band_triage_status_received_at_idx" ON "email_messages"("band", "triage_status", "received_at" DESC);

-- CreateIndex
CREATE INDEX "email_messages_from_address_idx" ON "email_messages"("from_address");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_account_id_folder_uid_validity_uid_key" ON "email_messages"("account_id", "folder", "uid_validity", "uid");

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_evidence_source_id_fkey" FOREIGN KEY ("evidence_source_id") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_evidence_source_id_fkey" FOREIGN KEY ("evidence_source_id") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written guards (Prisma cannot express them). Additive only.
-- Milestone: Enquiry Intelligence MVP (docs/plans/active/CURRENT.md, section 13).
-- ─────────────────────────────────────────────────────────────────────────────

-- Parser output is write-once (generic: names the table in the error).
CREATE FUNCTION guard_extracted_data_write_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.extracted_data IS NOT NULL AND NEW.extracted_data IS DISTINCT FROM OLD.extracted_data THEN
    RAISE EXCEPTION '%.extracted_data is write-once', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enquiry_items_extracted_data_guard
  BEFORE UPDATE ON enquiry_items FOR EACH ROW EXECUTE FUNCTION guard_extracted_data_write_once();
CREATE TRIGGER enquiries_extracted_data_guard
  BEFORE UPDATE ON enquiries FOR EACH ROW EXECUTE FUNCTION guard_extracted_data_write_once();

-- CHECK constraints ----------------------------------------------------------
ALTER TABLE enquiry_items
  ADD CONSTRAINT enquiry_items_quantity_positive CHECK (quantity IS NULL OR quantity > 0),
  ADD CONSTRAINT enquiry_items_source_lines
    CHECK (source_line_start IS NULL OR source_line_end IS NULL OR source_line_end >= source_line_start),
  ADD CONSTRAINT enquiry_items_confirmed_has_identity
    CHECK (review_status <> 'CONFIRMED' OR description IS NOT NULL OR model_text IS NOT NULL OR part_number IS NOT NULL);

ALTER TABLE email_accounts
  ADD CONSTRAINT email_accounts_port_range CHECK (port BETWEEN 1 AND 65535);

ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_score_range CHECK (score BETWEEN 0 AND 100),
  ADD CONSTRAINT email_messages_raw_size CHECK (raw_size >= 0),
  ADD CONSTRAINT email_messages_triage_consistency CHECK (
    (triage_status = 'ENQUIRY_CREATED') = (enquiry_id IS NOT NULL)
    AND ((triage_status = 'DISMISSED') = (dismissed_at IS NOT NULL))
    AND ((triage_status = 'DISMISSED') = (dismissed_reason IS NOT NULL))
  );

-- One message per (account, Message-ID) when the header exists -------------------
CREATE UNIQUE INDEX email_messages_account_message_id_key
  ON email_messages (account_id, message_id) WHERE message_id IS NOT NULL;

-- Emails are evidence: immutable except the triage columns, never deleted ----------
CREATE FUNCTION guard_email_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not allowed: emails are evidence', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF (NEW.account_id, NEW.folder, NEW.uid, NEW.uid_validity, NEW.message_id, NEW.in_reply_to, NEW.references_header, NEW.from_name,
      NEW.from_address, NEW.to_addresses, NEW.cc_addresses, NEW.subject, NEW.sent_at, NEW.received_at, NEW.text_body, NEW.attachments,
      NEW.raw_size, NEW.parse_error, NEW.score, NEW.score_reasons, NEW.band, NEW.evidence_source_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.account_id, OLD.folder, OLD.uid, OLD.uid_validity, OLD.message_id, OLD.in_reply_to, OLD.references_header, OLD.from_name,
      OLD.from_address, OLD.to_addresses, OLD.cc_addresses, OLD.subject, OLD.sent_at, OLD.received_at, OLD.text_body, OLD.attachments,
      OLD.raw_size, OLD.parse_error, OLD.score, OLD.score_reasons, OLD.band, OLD.evidence_source_id, OLD.created_at)
     OR NEW.raw_source IS DISTINCT FROM OLD.raw_source THEN
    RAISE EXCEPTION 'only the triage columns of % may be updated', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER email_messages_guard
  BEFORE UPDATE OR DELETE ON email_messages FOR EACH ROW EXECUTE FUNCTION guard_email_message();
