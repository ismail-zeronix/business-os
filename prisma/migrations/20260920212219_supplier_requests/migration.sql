-- CreateEnum
CREATE TYPE "SupplierRequestStatus" AS ENUM ('DRAFT', 'SENT', 'REPLIED', 'NO_STOCK', 'DECLINED');

-- AlterTable
ALTER TABLE "broadcasts" ADD COLUMN     "supplier_request_id" UUID;

-- CreateTable
CREATE TABLE "supplier_requests" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "contact_id" UUID,
    "status" "SupplierRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "PreferredChannel",
    "message_text" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "sent_by_id" UUID,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_requests_supplier_id_idx" ON "supplier_requests"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_requests_enquiry_id_supplier_id_key" ON "supplier_requests"("enquiry_id", "supplier_id");

-- CreateIndex
CREATE INDEX "broadcasts_supplier_request_id_idx" ON "broadcasts"("supplier_request_id");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_supplier_request_id_fkey" FOREIGN KEY ("supplier_request_id") REFERENCES "supplier_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_requests" ADD CONSTRAINT "supplier_requests_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_requests" ADD CONSTRAINT "supplier_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_requests" ADD CONSTRAINT "supplier_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "supplier_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_requests" ADD CONSTRAINT "supplier_requests_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_requests" ADD CONSTRAINT "supplier_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints ----------------------------------------------------------
ALTER TABLE supplier_requests
  ADD CONSTRAINT supplier_requests_sent_together
    CHECK ((sent_at IS NULL) = (message_text IS NULL) AND (sent_at IS NULL) = (sent_by_id IS NULL)),
  ADD CONSTRAINT supplier_requests_sent_status CHECK (status <> 'SENT' OR sent_at IS NOT NULL),
  ADD CONSTRAINT supplier_requests_channel_needs_sent CHECK (channel IS NULL OR sent_at IS NOT NULL),
  ADD CONSTRAINT supplier_requests_message_not_blank CHECK (message_text IS NULL OR btrim(message_text) <> '');

-- What was sent is write-once, and a sent request is never deleted ------------
CREATE FUNCTION guard_supplier_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sent_at IS NOT NULL THEN
      RAISE EXCEPTION 'a sent supplier request cannot be deleted' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.sent_at IS NOT NULL AND (
       NEW.message_text IS DISTINCT FROM OLD.message_text
    OR NEW.sent_at      IS DISTINCT FROM OLD.sent_at
    OR NEW.sent_by_id   IS DISTINCT FROM OLD.sent_by_id
    OR NEW.channel      IS DISTINCT FROM OLD.channel) THEN
    RAISE EXCEPTION 'supplier_requests: the sent message, time and channel are write-once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER supplier_requests_guard
  BEFORE UPDATE OR DELETE ON supplier_requests FOR EACH ROW EXECUTE FUNCTION guard_supplier_request();

-- A reply must come from the supplier the request was sent to ----------------
CREATE FUNCTION guard_broadcast_request_supplier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.supplier_request_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM supplier_requests r WHERE r.id = NEW.supplier_request_id AND r.supplier_id = NEW.supplier_id) THEN
    RAISE EXCEPTION 'a reply must be from the supplier the request was sent to' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER broadcasts_request_supplier_guard
  BEFORE INSERT OR UPDATE OF supplier_id, supplier_request_id ON broadcasts FOR EACH ROW EXECUTE FUNCTION guard_broadcast_request_supplier();
