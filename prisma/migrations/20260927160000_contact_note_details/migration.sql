-- Additive only: contact details a person confirmed from the pasted text, and a typed one-line description. Existing rows keep their text and get empty details.
ALTER TABLE "contact_notes"
    ADD COLUMN "contact_name" TEXT,
    ADD COLUMN "company" TEXT,
    ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "description" TEXT;
