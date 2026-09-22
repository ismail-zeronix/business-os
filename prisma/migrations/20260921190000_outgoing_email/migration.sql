-- CreateEnum
CREATE TYPE "SentEmailStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_signature" TEXT;

-- CreateTable
CREATE TABLE "smtp_accounts" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" "EmailSecurity" NOT NULL DEFAULT 'SSL_TLS',
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "reply_to" TEXT,
    "default_bcc" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_test_at" TIMESTAMPTZ(3),
    "last_test_status" "EmailSyncStatus",
    "last_test_error" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "smtp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_emails" (
    "id" UUID NOT NULL,
    "smtp_account_id" UUID NOT NULL,
    "quotation_id" UUID,
    "customer_id" UUID,
    "to_addresses" JSONB NOT NULL,
    "cc_addresses" JSONB NOT NULL,
    "bcc_addresses" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "attachment_name" TEXT,
    "attachment_size" INTEGER,
    "attachment_sha256" TEXT,
    "attachment_bytes" BYTEA,
    "message_id" TEXT,
    "status" "SentEmailStatus" NOT NULL,
    "error" TEXT,
    "sent_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_emails_quotation_id_created_at_idx" ON "sent_emails"("quotation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sent_emails_customer_id_created_at_idx" ON "sent_emails"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sent_emails_smtp_account_id_idx" ON "sent_emails"("smtp_account_id");

-- AddForeignKey
ALTER TABLE "smtp_accounts" ADD CONSTRAINT "smtp_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_smtp_account_id_fkey" FOREIGN KEY ("smtp_account_id") REFERENCES "smtp_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints -----------------------------------------------------------
ALTER TABLE smtp_accounts
  ADD CONSTRAINT smtp_accounts_port_range CHECK (port BETWEEN 1 AND 65535),
  ADD CONSTRAINT smtp_accounts_from_address_shape CHECK (position('@' IN from_address) > 1);

-- One outgoing account is active at a time ----------------------------------------
CREATE UNIQUE INDEX smtp_accounts_one_active ON smtp_accounts ((true)) WHERE status = 'ACTIVE';

ALTER TABLE sent_emails
  ADD CONSTRAINT sent_emails_recipients_shape CHECK (
    jsonb_typeof(to_addresses) = 'array' AND jsonb_array_length(to_addresses) >= 1
    AND jsonb_typeof(cc_addresses) = 'array' AND jsonb_typeof(bcc_addresses) = 'array'),
  -- A failed attempt says why; a sent one does not carry an error.
  ADD CONSTRAINT sent_emails_error_iff_failed CHECK ((status = 'FAILED') = (error IS NOT NULL)),
  ADD CONSTRAINT sent_emails_attachment_all_or_none CHECK (
    (attachment_bytes IS NULL) = (attachment_name IS NULL) AND (attachment_bytes IS NULL) = (attachment_sha256 IS NULL));

-- A sent email is a record of what happened: written once, never changed or deleted --------
CREATE FUNCTION guard_sent_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: a sent email is a permanent record', TG_OP, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER sent_emails_guard
  BEFORE UPDATE OR DELETE ON sent_emails FOR EACH ROW EXECUTE FUNCTION guard_sent_email();
