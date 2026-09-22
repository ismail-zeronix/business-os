# Enquiry Intelligence MVP: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.
> This is the task breakdown of `docs/plans/active/CURRENT.md`, not a second plan. If they disagree, `CURRENT.md` wins.

**Goal:** Manual enquiries and IMAP email triage on top of the existing supplier intelligence, plus a Settings sidebar that hosts email accounts.

**Architecture:** Modular monolith, `actions.ts` (thin) -> `service.ts(ctx)` -> Prisma -> PostgreSQL. `Enquiry` / `EnquiryItem` mirror `Broadcast` / `BroadcastItem` and reuse evidence, parser extractors, product matching, audit and `getProductIntelligence`. Email is stored as immutable evidence, scored deterministically and turned into an enquiry only by a person.

**Tech Stack:** Next.js 16.3.5, React 19.2.8, TypeScript 5.9, Prisma 7.10 (`@prisma/adapter-pg`), PostgreSQL 17 (Docker, `127.0.0.1:5442`), zod 4, Tailwind 4 + shadcn/ui, Lucide. New dependencies: **imapflow**, **postal-mime** only.

**Spec:** `docs/plans/active/CURRENT.md`

## How this plan differs from the generic template

The project rules (`CLAUDE.md`) override the template: **no test files, no TDD steps, no commits** (the folder is not a git repository). Each task is verified by: `npm run typecheck`, `npm run lint`, loading the affected pages against the dev server, and, where logic is not reachable from a page, a throw-away script in the session scratchpad that calls the service against the **project database** with data labelled `TEST`. Never `prisma migrate reset` / `db push`. Never create another database or server.

## Global Constraints (from `CLAUDE.md` and `CURRENT.md`, verbatim values)

- Node `>=22.12`; Prisma **7.10** and TypeScript **5.9** are pinned on purpose; Next is `16.3.5`, whose docs are in `node_modules/next/dist/docs/` and MUST be read before writing framework code.
- Database: `127.0.0.1:5442` (never `localhost`, never 5432). Migrations only. Timestamps UTC, displayed `Asia/Dubai`.
- Every input validated with zod; integrity in Prisma/PostgreSQL constraints; audit in the same transaction as the change; services take `ctx = { actor, db }`; actions stay thin.
- Services and `scripts/` import with **relative paths** (no `@/`), so `tsx` scripts can run them. Actions and components may use `@/`.
- Business rules: raw evidence immutable; unknown stays unknown (NULL / `UNKNOWN`); parsers propose and people confirm; deterministic before LLM; never fabricate data; label anything created for verification `TEST`.
- UI: `docs/design/UI_SYSTEM.md`. Compact, thin, tables first, no oversized cards, no gradients, no emoji, drawers not modals, errors inline and toasts only for success.
- Mailbox password: AES-256-GCM, format `v1:<iv>:<tag>:<ciphertext>` (base64), key `APP_SECRET_KEY` (32 bytes, base64); write-only in the UI; never in logs, errors, audit details or query results outside sync/test-connection; IMAP folder opened **read-only**; certificate validation always on; security is `SSL_TLS` or `STARTTLS` only.
- Email scoring bands: 70+ LIKELY, 40-69 REVIEW, below 40 LOW; stored score clamped 0-100. Max 200 messages per sync run; raw MIME above 20 MB is not stored (recorded as too large).
- Hostinger defaults (editable): host `imap.hostinger.com`, port `993`, `SSL_TLS`, folder `INBOX`, sync-from = 7 days ago.
- No enquiry is ever created automatically from email.

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `docs/decisions/0005-email-account-secrets.md` | ADR for the password/host/read-only decisions |
| `prisma/migrations/<ts>_enquiry_email_intelligence/migration.sql` | Additive schema + guards |
| `src/core/security/secret-box.ts` | AES-256-GCM encrypt/decrypt, pure |
| `src/components/application/settings-nav.tsx` | Settings secondary sidebar |
| `src/app/(workspace)/settings/layout.tsx`, `page.tsx`, `brands/page.tsx`, `categories/page.tsx`, `email/page.tsx` | Route-based settings |
| `src/modules/customers/{schemas,service,contact.service,queries,filters,actions}.ts` and `components/{customer-form,contact-form,contacts-panel,customers-table}.tsx` | Customers |
| `src/app/(workspace)/customers/page.tsx`, `customers/[id]/page.tsx` | Customer screens |
| `src/modules/enquiries/{schemas,service,queries,filters,actions,intelligence}.ts` | Enquiry backend |
| `src/modules/enquiries/parsing/{types,extractors,quoted,enquiry-parser}.ts` | Pure requirement parser |
| `src/modules/enquiries/components/*.tsx` | Enquiry UI (form, header, suggestions, item row/editor/fields/controls, linker, intelligence, notes, table) |
| `src/app/(workspace)/enquiries/page.tsx`, `enquiries/new/page.tsx`, `enquiries/[id]/page.tsx` | Enquiry screens |
| `src/modules/email/{schemas,imap,mime,text,account.service,sync.service,triage.service,queries,filters,actions}.ts` | Email backend |
| `src/modules/email/scoring/{config,score}.ts` | Pure deterministic scoring |
| `src/modules/email/components/*.tsx` | Accounts table/form/actions, triage table, email drawer, triage actions |
| `src/app/(workspace)/emails/[id]/raw/route.ts` | `.eml` download |
| `scripts/mail-sync.ts` | One-shot / `--watch` sync |

**Modify (additive)**: `prisma/schema.prisma`, `.env.example`, `.env` (local key), `package.json` (deps, scripts), `next.config.ts` (`serverExternalPackages`), `src/config/navigation.ts` + `navigation.test.ts` (one assertion), `src/modules/audit/{types,describe}.ts`, `src/lib/labels.ts`, `src/components/application/status-badges.tsx`, `src/app/(workspace)/page.tsx` (Overview), `src/modules/broadcasts/components/raw-pane.tsx` (optional `title`/`label` props, defaults unchanged), `src/modules/products/master-data.actions.ts` (revalidate paths), docs listed in `CURRENT.md` section 18.

---

## Interfaces registry (names used across tasks)

```ts
// customers
createCustomer(ctx, input: CustomerCreateInput): Promise<Customer>
updateCustomer(ctx, input: CustomerUpdateInput): Promise<Customer>
setCustomerStatus(ctx, input: { id: string; status: RecordStatus }): Promise<Customer>
addCustomerContact(ctx, input: CustomerContactCreateInput): Promise<CustomerContact>
updateCustomerContact(ctx, input: CustomerContactUpdateInput): Promise<CustomerContact>
setCustomerContactStatus(ctx, input: { id: string; status: RecordStatus }): Promise<CustomerContact>
listCustomers(params: CustomerListParams): Promise<{ rows: CustomerListRow[]; total: number }>
getCustomer(id: string), listCustomerContacts(customerId: string, o?: { includeArchived?: boolean }), countCustomerContacts(customerId: string)
listCustomerOptions(alsoId?: string): Promise<{ value: string; label: string }[]>
listCustomerContactOptions(): Promise<{ customerId: string; value: string; label: string }[]>
findKnownCustomerByEmail(email: string): Promise<{ customerId: string; customerName: string; contactId: string; contactName: string } | null>

// enquiry parsing (pure)
type EnquiryParseContext = { brands: string[]; families: string[] }
type EnquiryHeaderProposal = { deliveryLocation: string | null; priority: "URGENT" | null; requiredByText: string | null; reasons: string[] }
type ParsedEnquiryItem = { position: number; sourceText: string; sourceLineStart: number; sourceLineEnd: number; confidence: ExtractionConfidence;
  description: string | null; brandText: string | null; familyText: string | null; modelText: string | null; partNumber: string | null;
  specText: string | null; quantity: number | null; extractedData: { parser: string; version: string; reasons: string[]; hints: Record<string, string> } }
type EnquiryParseResult = { header: EnquiryHeaderProposal; items: ParsedEnquiryItem[] }
interface EnquiryParser { readonly name: string; readonly version: string; parse(rawText: string, context: EnquiryParseContext): EnquiryParseResult }
export const enquiryRulesParser: EnquiryParser
export function visibleLineCount(rawText: string): number      // lines before quoted reply text; numbering is never changed

// enquiry services (ctx = ServiceContext)
type EnquirySource =
  | { kind: "new"; channel: EvidenceChannel; observedAt: Date; rawText: string }
  | { kind: "existing"; evidenceSourceId: string }
createEnquiry(ctx, input: { source: EnquirySource; customerId: string | null; contactId: string | null; requesterName: string | null; requesterEmail: string | null; subject: string | null; notes: string | null }): Promise<{ enquiry: Enquiry; itemCount: number }>
updateEnquiryHeader(ctx, input: EnquiryHeaderInput): Promise<Enquiry>
setEnquiryStatus(ctx, input: { id: string; status: EnquiryStatus; note: string | null }): Promise<Enquiry>
addEnquiryNote(ctx, input: { id: string; note: string }): Promise<void>
setEnquiryArchived(ctx, input: { id: string; archived: boolean }): Promise<Enquiry>
applyHeaderSuggestion(ctx, input: { id: string; field: "deliveryLocation" | "priority" }): Promise<Enquiry>
createCustomerFromRequester(ctx, input: { enquiryId: string; name: string; contactName: string | null; contactEmail: string | null }): Promise<Enquiry>
updateEnquiryItem / addManualEnquiryItem / setEnquiryItemProduct / createProductForEnquiryItem
confirmEnquiryItem(ctx, itemId: string) / saveAndConfirmEnquiryItem(ctx, input) / ignoreEnquiryItem / reopenEnquiryItem
listEnquiries(params: { view: EnquiryView; page: number; q?: string; customerId?: string }): Promise<{ rows: EnquiryListRow[]; total: number }>
type EnquiryView = "attention" | "new" | "sourcing" | "waiting" | "quote" | "all" | "archived"
getEnquiry(id: string), getEnquiryItemCandidates(item), listEnquiriesNeedingAttention(limit?: number)
getItemIntelligence(item: { productId: string | null; brandText: string | null }): Promise<{ offers: SupplierIntelligenceRow[]; coverage: { supplierId: string; name: string }[] }>

// email
encryptSecret(plain: string): string;  decryptSecret(payload: string): string;  isSecretKeyConfigured(): boolean
createEmailAccount(ctx, input) / updateEmailAccount(ctx, input) / setEmailAccountStatus(ctx, input)
testImapConnection(input: { host; port; security; username; password; folder }): Promise<{ ok: true; messageCount: number } | { ok: false; message: string }>
syncAccount(ctx, accountId: string): Promise<{ ingested: number; skipped: number; errors: number; remaining: boolean }>
scoreEmail(input: ScoreInput, context: ScoreContext): { score: number; band: EmailBand; reasons: { label: string; points: number }[] }
createEnquiryFromEmail(ctx, emailId: string): Promise<{ enquiryId: string }>
dismissEmail(ctx, input: { id: string; reason: string }) / restoreEmail(ctx, input: { id: string })
```

---

## Task 1: Documentation, environment, schema and migration

**Files:** Create `docs/decisions/0005-email-account-secrets.md`, migration folder. Modify `prisma/schema.prisma`, `.env.example`, `.env`, `src/modules/audit/types.ts`, `describe.ts`, `src/lib/labels.ts`.

- [ ] **Step 1: Write ADR 0005** (short: context, decision, consequences) recording section 11 of `CURRENT.md`: AES-256-GCM in DB, `APP_SECRET_KEY` in `.env`, write-only password, read-only mailbox, host field trust, no key rotation yet (re-enter passwords), authentication as a hard prerequisite.

- [ ] **Step 2: Add `APP_SECRET_KEY` and `MAIL_SYNC_INTERVAL_MINUTES`** to `.env.example` (empty key + the generation command as a comment: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), and generate a real key into the local `.env` (which is git-ignored). Do not print the key in chat.

- [ ] **Step 3: Extend `prisma/schema.prisma`.** Append to `EvidenceKind`: `CUSTOMER_ENQUIRY`, `CUSTOMER_EMAIL`. Add these enums and models exactly (add the back-relations listed after):

```prisma
enum EnquiryStatus { NEW ASSIGNED SOURCING WAITING_SUPPLIER QUOTATION_READY QUOTED NEGOTIATION FOLLOW_UP WON LOST ON_HOLD }
enum EnquiryPriority { LOW NORMAL HIGH URGENT }
enum EmailSecurity { SSL_TLS STARTTLS }
enum EmailBand { LIKELY REVIEW LOW }
enum EmailTriageStatus { NEW ENQUIRY_CREATED DISMISSED }
enum EmailSyncStatus { OK ERROR }

model Customer {
  id             String       @id @default(uuid(7)) @db.Uuid
  name           String
  normalizedName String       @unique @map("normalized_name")
  legalName      String?      @map("legal_name")
  trn            String?
  country        String?
  emirate        String?
  website        String?
  phone          String?
  email          String?
  notes          String?
  status         RecordStatus @default(ACTIVE)
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime     @updatedAt @map("updated_at") @db.Timestamptz(3)

  contacts  CustomerContact[]
  enquiries Enquiry[]

  @@index([status])
  @@map("customers")
}

model CustomerContact {
  id               String            @id @default(uuid(7)) @db.Uuid
  customerId       String            @map("customer_id") @db.Uuid
  name             String
  jobTitle         String?           @map("job_title")
  department       String?
  phone            String?
  whatsapp         String?
  email            String?
  /// lower-cased email, maintained by the service, used to match an email sender to a known customer.
  normalizedEmail  String?           @map("normalized_email")
  preferredChannel PreferredChannel? @map("preferred_channel")
  notes            String?
  status           RecordStatus      @default(ACTIVE)
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime          @updatedAt @map("updated_at") @db.Timestamptz(3)

  customer  Customer  @relation(fields: [customerId], references: [id], onDelete: Restrict)
  enquiries Enquiry[]

  @@index([customerId, status])
  @@index([normalizedEmail])
  @@map("customer_contacts")
}

model Enquiry {
  id               String          @id @default(uuid(7)) @db.Uuid
  /// Human reference, shown as ENQ-00012.
  number           Int             @unique @default(autoincrement())
  evidenceSourceId String          @unique @map("evidence_source_id") @db.Uuid
  customerId       String?         @map("customer_id") @db.Uuid
  contactId        String?         @map("contact_id") @db.Uuid
  requesterName    String?         @map("requester_name")
  requesterEmail   String?         @map("requester_email")
  subject          String?
  status           EnquiryStatus   @default(NEW)
  priority         EnquiryPriority @default(NORMAL)
  requiredBy       DateTime?       @map("required_by") @db.Date
  deliveryLocation String?         @map("delivery_location")
  blocker          String?
  nextAction       String?         @map("next_action")
  assignedToId     String?         @map("assigned_to_id") @db.Uuid
  notes            String?
  /// The parser's original header proposals, write-once (trigger).
  extractedData    Json?           @map("extracted_data")
  archivedAt       DateTime?       @map("archived_at") @db.Timestamptz(3)
  lastActivityAt   DateTime        @default(now()) @map("last_activity_at") @db.Timestamptz(3)
  createdById      String          @map("created_by_id") @db.Uuid
  createdAt        DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  evidenceSource EvidenceSource   @relation(fields: [evidenceSourceId], references: [id], onDelete: Restrict)
  customer       Customer?        @relation(fields: [customerId], references: [id], onDelete: Restrict)
  contact        CustomerContact? @relation(fields: [contactId], references: [id], onDelete: Restrict)
  assignedTo     User?            @relation("EnquiryAssignedTo", fields: [assignedToId], references: [id], onDelete: Restrict)
  createdBy      User             @relation("EnquiryCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  items          EnquiryItem[]
  email          EmailMessage?

  @@index([status, lastActivityAt(sort: Desc)])
  @@index([customerId])
  @@index([archivedAt])
  @@map("enquiries")
}

model EnquiryItem {
  id                   String                @id @default(uuid(7)) @db.Uuid
  enquiryId            String                @map("enquiry_id") @db.Uuid
  position             Int
  sourceText           String                @map("source_text")
  sourceLineStart      Int?                  @map("source_line_start")
  sourceLineEnd        Int?                  @map("source_line_end")
  origin               ItemOrigin
  extractionConfidence ExtractionConfidence? @map("extraction_confidence")
  /// Parser output { parser, version, reasons, hints, fields }, write-once (trigger).
  extractedData        Json?                 @map("extracted_data")

  // Current / corrected values. NULL = unknown.
  description String?
  brandText   String? @map("brand_text")
  familyText  String? @map("family_text")
  modelText   String? @map("model_text")
  partNumber  String? @map("part_number")
  specText    String? @map("spec_text")
  quantity    Int?
  notes       String?

  productId     String?          @map("product_id") @db.Uuid
  matchBasis    MatchBasis?      @map("match_basis")
  reviewStatus  ItemReviewStatus @default(PENDING) @map("review_status")
  confirmedAt   DateTime?        @map("confirmed_at") @db.Timestamptz(3)
  confirmedById String?          @map("confirmed_by_id") @db.Uuid
  ignoredReason String?          @map("ignored_reason")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  enquiry     Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Restrict)
  product     Product? @relation(fields: [productId], references: [id], onDelete: Restrict)
  confirmedBy User?    @relation("EnquiryItemConfirmedBy", fields: [confirmedById], references: [id], onDelete: Restrict)

  @@unique([enquiryId, position])
  @@index([enquiryId, reviewStatus])
  @@index([productId])
  @@map("enquiry_items")
}

model EmailAccount {
  id                String           @id @default(uuid(7)) @db.Uuid
  label             String
  host              String
  port              Int
  security          EmailSecurity    @default(SSL_TLS)
  username          String
  /// AES-256-GCM "v1:iv:tag:ciphertext". NEVER selected except by the sync and test-connection services.
  passwordEncrypted String           @map("password_encrypted")
  folder            String           @default("INBOX")
  /// lower(host)|lower(username)|folder. Enforces uniqueness case-insensitively.
  normalizedKey     String           @unique @map("normalized_key")
  syncFromDate      DateTime         @map("sync_from_date") @db.Timestamptz(3)
  status            RecordStatus     @default(ACTIVE)
  uidValidity       BigInt?          @map("uid_validity")
  lastUid           BigInt?          @map("last_uid")
  lastSyncAt        DateTime?        @map("last_sync_at") @db.Timestamptz(3)
  lastSyncStatus    EmailSyncStatus? @map("last_sync_status")
  lastSyncError     String?          @map("last_sync_error")
  /// Compare-and-set lease so two syncs of one account cannot overlap.
  syncLeaseUntil    DateTime?        @map("sync_lease_until") @db.Timestamptz(3)
  createdById       String           @map("created_by_id") @db.Uuid
  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt         DateTime         @updatedAt @map("updated_at") @db.Timestamptz(3)

  createdBy User           @relation("EmailAccountCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  messages  EmailMessage[]

  @@map("email_accounts")
}

/// Immutable evidence except the triage columns (trigger).
model EmailMessage {
  id               String     @id @default(uuid(7)) @db.Uuid
  accountId        String     @map("account_id") @db.Uuid
  folder           String
  uid              BigInt
  uidValidity      BigInt     @map("uid_validity")
  messageId        String?    @map("message_id")
  inReplyTo        String?    @map("in_reply_to")
  referencesHeader String?    @map("references_header")
  fromName         String?    @map("from_name")
  /// lower-cased
  fromAddress      String?    @map("from_address")
  toAddresses      Json       @map("to_addresses")
  ccAddresses      Json       @map("cc_addresses")
  subject          String?
  sentAt           DateTime?  @map("sent_at") @db.Timestamptz(3)
  receivedAt       DateTime   @map("received_at") @db.Timestamptz(3)
  /// Plain part, or HTML converted to text. The full MIME is in rawSource.
  textBody         String     @map("text_body")
  /// [{ filename, contentType, size }] metadata only.
  attachments      Json
  /// NULL when the message exceeded the size cap (rawSize still records the size).
  rawSource        Bytes?     @map("raw_source")
  rawSize          Int        @map("raw_size")
  parseError       String?    @map("parse_error")
  score            Int
  scoreReasons     Json       @map("score_reasons")
  band             EmailBand

  triageStatus    EmailTriageStatus @default(NEW) @map("triage_status")
  dismissedAt     DateTime?         @map("dismissed_at") @db.Timestamptz(3)
  dismissedById   String?           @map("dismissed_by_id") @db.Uuid
  dismissedReason String?           @map("dismissed_reason")
  enquiryId       String?           @unique @map("enquiry_id") @db.Uuid

  evidenceSourceId String   @unique @map("evidence_source_id") @db.Uuid
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  account        EmailAccount   @relation(fields: [accountId], references: [id], onDelete: Restrict)
  evidenceSource EvidenceSource @relation(fields: [evidenceSourceId], references: [id], onDelete: Restrict)
  enquiry        Enquiry?       @relation(fields: [enquiryId], references: [id], onDelete: Restrict)
  dismissedBy    User?          @relation("EmailDismissedBy", fields: [dismissedById], references: [id], onDelete: Restrict)

  @@unique([accountId, folder, uidValidity, uid])
  @@index([band, triageStatus, receivedAt(sort: Desc)])
  @@index([fromAddress])
  @@map("email_messages")
}
```

Back-relations: on `User` add `enquiriesCreated Enquiry[] @relation("EnquiryCreatedBy")`, `enquiriesAssigned Enquiry[] @relation("EnquiryAssignedTo")`, `enquiryItemsConfirmed EnquiryItem[] @relation("EnquiryItemConfirmedBy")`, `emailAccountsCreated EmailAccount[] @relation("EmailAccountCreatedBy")`, `emailMessagesDismissed EmailMessage[] @relation("EmailDismissedBy")`. On `EvidenceSource` add `enquiry Enquiry?` and `emailMessage EmailMessage?`. On `Product` add `enquiryItems EnquiryItem[]`.

- [ ] **Step 4: Generate the migration SQL without a shadow database.** Run `npx prisma migrate diff --help` to confirm the Prisma 7 flag names, then generate a script that compares the live database (config datasource) to `prisma/schema.prisma` (`--script`). Save it as `prisma/migrations/20260920120000_enquiry_email_intelligence/migration.sql`. **Verify by reading it**: it must contain only `CREATE TYPE`, `ALTER TYPE ... ADD VALUE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT` (foreign keys). If it contains any `DROP`, or `ALTER ... DROP`, stop and tell the user.

- [ ] **Step 5: Append the hand-written SQL** to the same `migration.sql`:

```sql
-- Generic write-once guard for parser output
CREATE FUNCTION guard_extracted_data_write_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.extracted_data IS NOT NULL AND NEW.extracted_data IS DISTINCT FROM OLD.extracted_data THEN
    RAISE EXCEPTION '%.extracted_data is write-once', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enquiry_items_extracted_data_guard BEFORE UPDATE ON enquiry_items FOR EACH ROW EXECUTE FUNCTION guard_extracted_data_write_once();
CREATE TRIGGER enquiries_extracted_data_guard BEFORE UPDATE ON enquiries FOR EACH ROW EXECUTE FUNCTION guard_extracted_data_write_once();

-- CHECK constraints
ALTER TABLE enquiry_items
  ADD CONSTRAINT enquiry_items_quantity_positive CHECK (quantity IS NULL OR quantity > 0),
  ADD CONSTRAINT enquiry_items_source_lines CHECK (source_line_start IS NULL OR source_line_end IS NULL OR source_line_end >= source_line_start),
  ADD CONSTRAINT enquiry_items_confirmed_has_identity CHECK (review_status <> 'CONFIRMED' OR description IS NOT NULL OR model_text IS NOT NULL OR part_number IS NOT NULL);
ALTER TABLE email_accounts ADD CONSTRAINT email_accounts_port_range CHECK (port BETWEEN 1 AND 65535);
ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_score_range CHECK (score BETWEEN 0 AND 100),
  ADD CONSTRAINT email_messages_raw_size CHECK (raw_size >= 0),
  ADD CONSTRAINT email_messages_triage_consistency CHECK (
    (triage_status = 'ENQUIRY_CREATED') = (enquiry_id IS NOT NULL)
    AND ((triage_status = 'DISMISSED') = (dismissed_at IS NOT NULL))
    AND ((triage_status = 'DISMISSED') = (dismissed_reason IS NOT NULL))
  );

-- One message per (account, Message-ID) when the header exists
CREATE UNIQUE INDEX email_messages_account_message_id_key ON email_messages (account_id, message_id) WHERE message_id IS NOT NULL;

-- Emails are evidence: immutable except triage columns; never deleted
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
CREATE TRIGGER email_messages_guard BEFORE UPDATE OR DELETE ON email_messages FOR EACH ROW EXECUTE FUNCTION guard_email_message();
```

- [ ] **Step 6: Apply and regenerate.** `npm run db:deploy` (that is `prisma migrate deploy`), then `npm run db:generate`. Expected: the new migration is applied and no other migration re-runs. Then `npm run typecheck`.

- [ ] **Step 7: Audit types and labels.** In `audit/types.ts` add entity types `Customer`, `CustomerContact`, `Enquiry`, `EnquiryItem`, `EmailAccount`, `EmailMessage` and the actions listed in `CURRENT.md` section 14. In `describe.ts` add a label for each. In `lib/labels.ts` add `ENQUIRY_STATUS_LABEL`, `ENQUIRY_PRIORITY_LABEL`, `EMAIL_BAND_LABEL` (Likely / Review / Low), `EMAIL_TRIAGE_LABEL`, `EMAIL_SECURITY_LABEL` (SSL/TLS, STARTTLS), and extend `EVIDENCE_CHANNEL_LABEL` untouched (channels are unchanged).

- [ ] **Step 8: Verify.** `npm run typecheck && npm run lint` clean. Spot-check the database with a read-only `psql`/script query that the six tables and the triggers exist (`SELECT tgname FROM pg_trigger WHERE tgname LIKE '%guard%'`).

---

## Task 2: Settings shell

**Files:** Create `components/application/settings-nav.tsx`, `app/(workspace)/settings/{layout,page}.tsx`, `settings/brands/page.tsx`, `settings/categories/page.tsx`. Modify `modules/products/master-data.actions.ts`.

- [ ] **Step 1: Read the relevant Next 16 docs** in `node_modules/next/dist/docs/` (layouts and pages, `redirect`, `PageProps`/`LayoutProps` typed helpers). Note any difference from the patterns already used in `app/(workspace)`.

- [ ] **Step 2: `SettingsNav`** (client, uses `usePathname`, styled like the main sidebar but thinner, about 176px): groups `Master data` (Brands `/settings/brands`, Categories `/settings/categories`). Active item uses the same accent style as `Sidebar`. Items are data (an array in the file) so later settings are one-line additions. The Email accounts item is added in Task 7, not now.

- [ ] **Step 3: `settings/layout.tsx`**: `PageHeader title="Settings"`, then a two-column flex: `SettingsNav` left, `{children}` right (`min-w-0 flex-1`). Layout type: `LayoutProps<"/settings">`.

- [ ] **Step 4: Pages.** `settings/page.tsx` does `redirect("/settings/brands")`, honouring the legacy `?tab=categories` (redirect to `/settings/categories`). `brands/page.tsx` and `categories/page.tsx` render the existing `MasterDataPanel` with the same actions and queries the old page used (copy the two branches of the old `settings/page.tsx`).

- [ ] **Step 5: Revalidation.** In `master-data.actions.ts` replace `revalidatePath("/settings")` (or equivalent) with the two new paths. Read the file first and change only the revalidate calls.

- [ ] **Step 6: Verify.** Typecheck and lint. With the dev server running, `curl` `/settings` (expect a redirect), `/settings/brands` and `/settings/categories` (200, contain the list and the sidebar labels).

---

## Task 3: Customers

**Files:** the `modules/customers/*` and `app/(workspace)/customers/*` paths in the file table.

- [ ] **Step 1: `schemas.ts`.** Copy the `suppliers/schemas.ts` pattern. `customerProfileSchema`: `name: requiredText("Customer name", 200)`, `legalName optionalText(200)`, `trn optionalText(30)`, `country`, `emirate`, `website optionalUrl()`, `phone`, `email optionalEmail()`, `notes optionalText(4000)`. `customerCreateSchema = customerProfileSchema`; `customerUpdateSchema = profile.extend({ id: z.uuid() })`; `customerStatusSchema`. `customerContactBaseSchema`: `name`, `jobTitle`, `department`, `phone`, `whatsapp`, `email optionalEmail()`, `preferredChannel optionalEnum(values(PreferredChannel))`, `notes`; create adds `customerId`, update adds `id`, status like suppliers. Export the `z.output` types.

- [ ] **Step 2: `service.ts` and `contact.service.ts`.** Mirror `suppliers/service.ts` and `contact.service.ts` without the brand/category association code. `normalizedName = normalizeName(name)`; unique conflict message: "A customer with this name already exists." (archived variant: "...exists but is archived. Restore it instead."). Contact writes set `normalizedEmail = email?.trim().toLowerCase() ?? null`. Audit actions: `customer.created|updated|status_changed`, `customer_contact.created|updated|archived`; contact audit `scope: { type: "Customer", id }`. `PROFILE_FIELDS` for diffs = all profile fields.

- [ ] **Step 3: `queries.ts`.** `listCustomers` (search over name, legal name, contact names and emails; status filter, archived hidden by default; server-side pagination with `PAGE_SIZE`). Each row also carries `contactCount`, `openEnquiries` (enquiries with status not in WON/LOST and `archivedAt` null) and `lastEnquiryAt` computed with grouped queries (no N+1: one `groupBy` on `enquiry` for the page's customer ids, plus `_count` of contacts in the select). `getCustomer`, `listCustomerContacts`, `countCustomerContacts`, `listCustomerOptions`, `listCustomerContactOptions`, and `findKnownCustomerByEmail(email)` = active contact with `normalizedEmail = email.trim().toLowerCase()` whose customer is not archived (first by name).

- [ ] **Step 5: `filters.ts` and `actions.ts`.** Copy the supplier equivalents (`parseCustomerFilters`, `hasActiveCustomerFilters`; actions `createCustomerAction`, `updateCustomerAction`, `setCustomerStatusAction`, `createCustomerContactAction`, `updateCustomerContactAction`, `setCustomerContactStatusAction`, all `(_prev, formData) => runAction(...)` with `revalidatePath("/customers")` and the detail path).

- [ ] **Step 6: Components** (copy the supplier equivalents, drop brand/category fields): `customer-form.tsx` (props: optional `customer`, optional `prefill` for the create-from-requester flow, optional `onCreated`), `contact-form.tsx`, `contacts-panel.tsx`, `customers-table.tsx` (columns Customer, Location, Contacts, Open enquiries, Last enquiry, Status; name cell is the stretched link).

- [ ] **Step 7: Pages.** `customers/page.tsx` (PageHeader, FilterBar with `SearchInput` + status `FilterSelect`, empty states "No customers yet" and "No customers match these filters", Pagination) and `customers/[id]/page.tsx` with `TabNav` tabs Overview, Contacts (count), Enquiries (table of the customer's enquiries using the enquiries table added in Task 6, so render a simple table now and swap in Task 6), Activity (`Timeline` of `listActivity({ type: "Customer", id })`).

- [ ] **Step 8: Verify.** Typecheck, lint, load `/customers` and a detail page. With a scratchpad script, create a `TEST Customer` and contact via the services, confirm the audit rows and that a duplicate name is rejected.

---

## Task 4: Enquiry parser, create-enquiry service and the new-enquiry screen

**Files:** `modules/enquiries/parsing/*`, `schemas.ts`, `service.ts` (create part), `queries.ts` (options), `actions.ts` (create), `components/enquiry-form.tsx`, `app/(workspace)/enquiries/new/page.tsx`.

- [ ] **Step 1: `parsing/types.ts`** with the parser types from the registry.

- [ ] **Step 2: `parsing/quoted.ts`.** `visibleLineCount(rawText)`: index of the first line that starts a quoted reply, else the total. A line starts one when it matches `/^\s*>/`, `/^\s*On .{5,120} wrote:\s*$/i`, `/^-{2,}\s*Original Message\s*-{2,}/i`, `/^\s*From:\s.+/i` immediately followed within 3 lines by `Sent:` or `Date:`, or `/^\s*_{5,}\s*$/`. The parser only reads lines up to this cutoff; line numbers stay those of the original text.

- [ ] **Step 3: `parsing/extractors.ts`** (pure; reuse `findBrand`, `findQuantity`, `findSpecs`, `findPartNumber` from `broadcasts/parsing/extractors` by relative import; do not modify them):

```ts
export type Span = [number, number];
/** "Need 200", "require 50 units", "qty: 25", "200 x", "supply of 40". Returns the number and its span. */
export function findRequestedQuantity(text: string, brands: readonly string[]): { quantity: number; span: Span; reason: string } | null
//   patterns in order: /\b(?:need|needs|require[sd]?|want|looking\s+for|supply(?:\s+of)?|quote\s+for|qty\.?|quantity)\s*[:=-]?\s*(\d{1,6})\b/i
//   then a number directly before a known brand: /(?<![\w.,])(\d{1,6})\s+(?=<brand>)/i (built from the brand list, escaped)
//   then broadcast findQuantity (pcs / units / nos / x N). Reject 0 and values above 999999.
export function findDelivery(text: string): { value: string; span: Span; reason: string } | null
//   /\b(?:deliver(?:y|ed)?|ship(?:ping|ped)?)\s*(?:to|at|in|:)?\s*([A-Z][A-Za-z .'-]{1,40}?)(?=[,.;\n]|\s+(?:urgent\w*|asap|by|within|before|on|and|for|with)\b|$)/
export function findUrgency(text: string): { span: Span; reason: string } | null
//   /\b(?:urgent(?:ly)?|asap|immediately|as\s+soon\s+as\s+possible|top\s+priority)\b/i
export function findRequiredByText(text: string): { value: string; span: Span; reason: string } | null
//   /\b(?:required|needed|deliver(?:y)?|deadline)\s+(?:by|before|within|date)\s*[:-]?\s*([^.,;\n]{2,40})/i,
//   /\bwithin\s+(\d{1,3}\s*(?:hours?|days?|weeks?))\b/i,
//   /\bby\s+((?:next\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day|tomorrow|end\s+of\s+(?:the\s+)?(?:week|month)|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/i
export function findFamily(text: string, families: readonly string[]): { name: string; span: Span } | null   // word-boundary, longest first, canonical spelling
export function classifySpecHints(snippets: readonly string[]): Record<string, string>
//   cpu: snippet matching ultra|i[3579]|ryzen|xeon|celeron|pentium|snapdragon. os: matches windows|win|w1[01]|dos|linux|ubuntu|chrome.
//   Capacity: a snippet with ssd|hdd|nvme, or TB, or GB >= 120 -> storage; a GB value in {4,8,12,16,24,32,48,64,96} (or "ram"/"ddr" present) -> ram.
//   First match per key wins. Values are the snippet text as written. Keys omitted when not found.
```

- [ ] **Step 4: `parsing/enquiry-parser.ts`.** `enquiryRulesParser` (`name: "enquiry-rules"`, `version: "1"`): take `lines = toLines(rawText).slice(0, visibleLineCount(rawText))` and `blocks = toBlocks(lines)` (imports from `broadcasts/parsing/text`). Header proposals come from the whole visible text (`flat`): delivery, urgency (`priority: "URGENT"` only when found), required-by text. For each block, a line is item-like when `(brand || family) && (requestedQty || specs || modelToken)` or `partNumber found` or `(requestedQty && modelToken)`. Item-like lines start items; following non-item-like lines that contain specs attach to the previous item (same block); prose ("Dear Sir", "Please quote") is ignored. A block with a single item-like line is one item. Per item: quantity (`findRequestedQuantity`, else broadcast `findQuantity`), brand, family, specs (`specText` = snippets joined with " · "), part number, `modelText` = first digit-bearing token after the brand/family (as `rules-parser.ts` does), `description` = text from the brand (or family) start to the first later explained span (quantity, spec, delivery, urgency, required-by, part number), trimmed. Delivery, urgency and required-by spans are excluded from the description. `extractedData.hints` = `classifySpecHints(...)` plus `delivery` when found. Confidence: HIGH if brand and (model or part number) and quantity; MEDIUM if (brand or family) and (quantity or specs); else LOW. Return `null` items for chatter. **Nothing is defaulted: missing fields are `null`.**

- [ ] **Step 5: `schemas.ts`.**
  - `enquiryCreateSchema`: `customerId optionalUuid()`, `contactId optionalUuid()`, `requesterName optionalText(200)`, `requesterEmail optionalEmail()`, `channel` (`EvidenceChannel`, default `MANUAL_PASTE`), `receivedAt` string required, `subject optionalText(300)`, `notes optionalText(2000)`, `rawText` (required, not blank, at most 50,000 characters, kept verbatim).
  - `MAX_RAW_TEXT = 50_000`.
  - Item schemas (Task 5) live in the same file.

- [ ] **Step 6: `service.ts` (create part).** Helpers: `enquiryScope(id)`, `touchEnquiry(c, id)` (sets `lastActivityAt = now`). `createEnquiry` per the registry, in one `inTransaction`:
  1. Validate customer (exists, not archived) and contact (belongs to that customer, not archived); a contact without a customer is a `ValidationError`.
  2. Evidence: `source.kind === "new"` -> `createEvidence(c, { kind: "CUSTOMER_ENQUIRY", channel, rawText, observedAt })`; `"existing"` -> load the `EvidenceSource`, require it has no enquiry yet (`ConflictError` "This email already has an enquiry") and reuse it.
  3. `brands` = non-archived brand names, `families` = distinct non-empty `family` values of non-archived products; run `enquiryRulesParser.parse(evidence.rawText, { brands, families })`.
  4. Create `Enquiry` (`extractedData: { parser, version, header: proposal }`), then each item like `createBroadcast` does: `findMatchCandidates` + `pickAutoLink`, `extractedData: { ...item.extractedData, fields: { description, brandText, familyText, modelText, partNumber, specText, quantity } }`, `origin: "PARSER"`, `extractionConfidence`, `productId`/`matchBasis` from the pre-link, `reviewStatus` stays `PENDING`.
  5. `writeAudit` `enquiry.created` with `{ number, source, items, parser }`.

- [ ] **Step 7: `queries.ts` (options only for now)** and **`actions.ts`** with `createEnquiryAction` (parse form -> `zonedInputToUtc` and the "not in the future" check exactly as `createBroadcastAction` -> `createEnquiry(..., { kind: "new" })` -> `revalidatePath("/enquiries")`, `revalidatePath("/", "layout")` -> `{ id }`).

- [ ] **Step 8: `components/enquiry-form.tsx` and `enquiries/new/page.tsx`.** Mirror `broadcast-form.tsx` and the new-broadcast page: Customer combobox (clearable), Contact combobox filtered by customer (use the same client-side filtering approach as the broadcast form), Requester name/email (shown when no customer is chosen), Channel select (Manual paste, WhatsApp, Email, Other), Received at (`datetime-local`, default now in Dubai time), Raw request (large mono textarea, `rawText`), Subject, Notes. A "+ New customer" drawer inside the form is **not** built; the page links to `/customers` in a hint instead (quick-create happens through the requester-to-customer flow in Task 5). Submit "Save and review" -> `router.push('/enquiries/<id>')` on success.

- [ ] **Step 9: Verify.** Typecheck, lint. With a scratchpad script call `enquiryRulesParser.parse` on: (a) `Need 200 Dell Latitude U7 16GB 512GB Windows Pro delivery Dubai urgently.` (expect one item: quantity 200, brand Dell, family Latitude, modelText `U7`, specs `16GB · 512GB · Windows Pro`, delivery `Dubai`, priority URGENT, hints ram/storage/os; **no** "Core Ultra 7"); (b) a numbered multi-line list of three products with prose around it; (c) a text with an email-style quoted tail (`> ...`) to confirm the tail is ignored. Print results and read them. Then create one `TEST` enquiry through `createEnquiry` and confirm `PENDING` items and the `enquiry.created` audit row. Load `/enquiries/new`.

---

## Task 5: Enquiry workspace

**Files:** `modules/enquiries/{service (rest),queries,intelligence,actions}.ts`, components, `app/(workspace)/enquiries/[id]/page.tsx`, small change to `broadcasts/components/raw-pane.tsx`.

- [ ] **Step 1: Item and header schemas.**
  - `enquiryItemFieldsSchema`: `description`, `brandText`, `familyText`, `modelText`, `partNumber`, `specText`, `quantity` (optional whole number **greater than 0**, blank -> null; write a local `optionalPositiveQuantity()` using the `optionalQuantity` pattern with `.min(1)`), `notes`.
  - `itemUpdateSchema` (+`id`), `itemManualCreateSchema` (+`enquiryId`, `sourceText`), `itemLinkSchema` (`itemId`, `productId`, `rememberAlias`), `itemCreateProductSchema` (`productProfileSchema` + `itemId` + `rememberAlias`), `itemReasonSchema`.
  - `enquiryHeaderSchema`: `id`, `customerId`, `contactId`, `requesterName`, `requesterEmail`, `subject`, `priority` (`EnquiryPriority`, required), `requiredBy` (optional `yyyy-mm-dd`, validated and stored as a UTC date), `deliveryLocation`, `blocker`, `nextAction`, `notes`, `assignedToId` (optional).
  - `enquiryStatusSchema` (`id`, `status`, `note optionalText(500)`), `enquiryNoteSchema` (`id`, `note` required, at most 2000), `enquiryArchiveSchema`, `enquirySuggestionSchema` (`id`, `field` enum).

- [ ] **Step 2: Enquiry services** (all `inTransaction`, audit with scope `Enquiry`, call `touchEnquiry`):
  - `updateEnquiryHeader`: diff fields (`customerId`, `contactId`, `requesterName`, `requesterEmail`, `subject`, `priority`, `requiredBy`, `deliveryLocation`, `blocker`, `nextAction`, `notes`, `assignedToId`); validate customer/contact as in create; no-op when unchanged; audit `enquiry.updated`.
  - `setEnquiryStatus`: audit `enquiry.status_changed` with `{ status: {from,to}, note }`. Setting `WON`/`LOST`/`ON_HOLD` needs no extra rule.
  - `addEnquiryNote`: audit-only entry `enquiry.note_added` with `{ note }`; touches the enquiry.
  - `setEnquiryArchived`: `archivedAt`; audit `enquiry.archived`.
  - `applyHeaderSuggestion`: read `extractedData.header`; `deliveryLocation` sets it only if currently null; `priority` sets `URGENT` only if the proposal has it and current is `NORMAL`; audit as `enquiry.updated`.
  - `createCustomerFromRequester`: in one transaction call `createCustomer` (name required) and, if `contactName` or `contactEmail`, `addCustomerContact`; then set `customerId` / `contactId` on the enquiry; audit `enquiry.updated`.
  - Item services mirror `broadcasts/service.ts` (`updateItem`, `addManualItem`, `setItemProduct`, `createProductForItem`, `ignoreItem`, `reopenItem`) against `enquiryItem`, with audit actions `enquiry_item.*` and scope `Enquiry`. Diffed fields: `description, brandText, familyText, modelText, partNumber, specText, quantity, notes`. **`confirmEnquiryItem`** requires a description, model or part number (`InvariantError` otherwise; the database CHECK backs this) and an ACTIVE product only if one is linked; it creates **no observations**. `reopenEnquiryItem` only flips status back to `PENDING` (no retraction). `saveAndConfirmEnquiryItem` = update then confirm in one transaction.
  - `requirePending` behaves like broadcasts. Editing an item of an archived enquiry is an `InvariantError`.

- [ ] **Step 3: Queries.** `getEnquiry(id)`: include evidence (`rawText`, `observedAt`, `channel`), customer, contact, assignee, `createdBy`, `email` (id only, for the `.eml` link), items ordered by position with `product` (id, name, partNumber, status, brand name). `getEnquiryItemCandidates(item)` = `findMatchCandidates`. `listUserOptions()` for the owner select (`user` table, active).

- [ ] **Step 4: `intelligence.ts`.** `getItemIntelligence({ productId, brandText })`: `offers = productId ? await getProductIntelligence(productId) : []`; `coverage` = ACTIVE suppliers with a `SupplierBrand` whose brand matches the linked product's `brandId`, else the brand whose `normalizedName` equals `normalizeName(brandText)`; select `id, name`, order by name, take 8; empty when no brand is known. Import `getProductIntelligence` from `../observations/procurement-queries`.

- [ ] **Step 5: Actions** (all thin, `runAction`, revalidate `/enquiries` and `/enquiries/<id>`; use `revalidatePath("/", "layout")` for status changes so Overview updates): `saveEnquiryItemAction` (`intent=confirm|save`), `ignoreEnquiryItemAction`, `reopenEnquiryItemAction`, `linkEnquiryItemAction`, `createProductForEnquiryItemAction`, `addManualEnquiryItemAction`, `updateEnquiryHeaderAction`, `setEnquiryStatusAction`, `addEnquiryNoteAction`, `archiveEnquiryAction`, `applySuggestionAction`, `createCustomerFromRequesterAction`. Reuse `searchProductsForLinkAction` from `broadcasts/actions` (import it; do not duplicate).

- [ ] **Step 6: `raw-pane.tsx`** (broadcasts): add optional props `title = "Raw broadcast"` and `label = "Original supplier message"`, used in the header text and `aria-label`. Defaults keep broadcasts unchanged.

- [ ] **Step 7: Components** (`modules/enquiries/components/`). Read the corresponding broadcast component first and follow it; each is a copy adapted to the enquiry actions and fields:
  - `item-fields.tsx` (`EnquiryItemFieldsGrid`): description, brand, family, model, part number, spec, quantity, notes; the `ItemFieldValues` type lives here.
  - `item-editor.tsx`: Confirm (Ctrl+Enter) / Save; hint text "Confirming means you verified the requirement. It records no prices.".
  - `item-controls.tsx`: `IgnoreControl`, `ReopenControl` (reopen popover text: "Returns this item to review. Nothing else changes.").
  - `product-linker.tsx` and `item-product-form.tsx`: adapted from the broadcast versions, wired to `linkEnquiryItemAction` / `createProductForEnquiryItemAction`; the create-product drawer is prefilled from the item.
  - `item-row.tsx`: collapsed row (position, description, brand/model/part/spec, quantity, match badge, review badge); selected row expands with `ProductLinker`, `EnquiryItemEditor`, "How this was read" (reasons and hint chips for cpu/ram/storage/os), and `IntelligencePanel`.
  - `intelligence-panel.tsx` (server component): if `offers.length`, a compact table Supplier / Price / Stock / Observed / Evidence using `formatMoney`, `StockBadge`, `VatBadge`, `FreshnessBadge`, and `EvidenceLink` (href `?item=<id>&evidence=<observationId>` opening the existing `EvidenceDrawer`); else the empty text "No supplier observations for this product yet" or, with no linked product, "Link a product to see supplier prices and stock"; below it a `Suppliers covering <brand>` line listing `coverage` names as links to `/suppliers/<id>`.
  - `header-panel.tsx`: a `KeyValue` block (Customer or requester, Contact, Subject, Received, Required by, Delivery, Blocker, Next action, Owner, Notes) and an Edit drawer using `enquiry-header-form.tsx` (customer and contact comboboxes, priority select, required-by `date` input, delivery, blocker, next action, owner select, notes). When there is no customer and a requester exists, show a "Save as customer" drawer (`create-customer-form.tsx`) prefilled from the requester.
  - `status-control.tsx`: popover with a status select and an optional note, submits `setEnquiryStatusAction`.
  - `suggestions-strip.tsx`: shows only proposals not yet applied (delivery when `deliveryLocation` is null; priority when the proposal is URGENT and the current priority is NORMAL) as "Detected: Delivery Dubai [Apply]" chips; required-by text is shown as a plain hint with no Apply.
  - `notes-composer.tsx`: textarea + "Add note" in the Activity tab.

- [ ] **Step 8: `enquiries/[id]/page.tsx`.** Mirror `broadcasts/[id]/page.tsx`: metadata, uuid guard, `getEnquiry`, `notFound`. Header: breadcrumb (Enquiries > `ENQ-00012`), title `ENQ-00012 · <customer or requester or "No customer">`, meta badges (status, priority, item progress), actions (Add item drawer, `StatusControl`, Archive control). Suggestions strip, header panel, `TabNav` (`view` param) with Items and Activity. Items view: `RawPane` (title "Raw request", label "Original customer request"; ranges from item line numbers) on the left; filter chips (all/pending/confirmed/ignored) and `ItemRow` list on the right; selection, `nextItemId`, candidates, `keepQuery` exactly as broadcasts do; `ReviewKeys` reused from broadcasts (import; it is generic over ids). For email-sourced enquiries show "Download original (.eml)" linking `/emails/<emailId>/raw`. Also mount the existing `EvidenceDrawer` with `observationId={firstParam(searchParams, "evidence")}`. Activity view: `NotesComposer` and `Timeline` of `listActivity({ type: "Enquiry", id })`.

- [ ] **Step 9: Verify.** Typecheck, lint. Using the `TEST` enquiry from Task 4, `curl` the workspace page (200; contains the raw text and item description). With a scratchpad script: edit an item, link/create a `TEST` product, confirm, reopen, add a note, change status; read the audit rows. Check that confirming with no description/model/part number is rejected. If a product with observations exists, check `getItemIntelligence` returns rows; if none exist, say so (no fabricated data).

---

## Task 6: Enquiry inbox, navigation and Overview

**Files:** `modules/enquiries/{filters,queries}.ts` (list), `components/enquiries-table.tsx`, `app/(workspace)/enquiries/page.tsx`, `config/navigation.ts` + test, `status-badges.tsx`, `app/(workspace)/page.tsx`, `customers/[id]/page.tsx` (swap in the table).

- [ ] **Step 1: `listEnquiries`.** Views: `attention` = not archived, status NOT IN (WON, LOST) AND (status = NEW OR any PENDING item); `new` = NEW; `sourcing` = SOURCING; `waiting` = WAITING_SUPPLIER; `quote` = QUOTATION_READY; `all` = not archived; `archived` = archived. Optional `q` searches subject, requester name/email, customer name, item descriptions/models/part numbers and `ENQ-` number (`number` equality when `q` matches `/^ENQ-?0*(\d+)$/i`). Order `evidenceSource.observedAt desc`. Select for each row: number, status, priority, evidence `observedAt` and `channel`, customer name, requester name, subject, first two items' descriptions, item counts by review status (`items: { select: { reviewStatus: true, description: true } }`). Server-side pagination. `listEnquiriesNeedingAttention(limit = 8)` = first page of `attention`.

- [ ] **Step 2: Badges.** Add `EnquiryStatusBadge` and `PriorityBadge` to `status-badges.tsx`: NEW warning, ASSIGNED/SOURCING/WAITING_SUPPLIER/QUOTATION_READY info, QUOTED/NEGOTIATION/FOLLOW_UP neutral, WON success, LOST muted, ON_HOLD muted; priority URGENT danger, HIGH warning, NORMAL/LOW muted-neutral (NORMAL rendered as nothing in tables to reduce noise).

- [ ] **Step 3: `enquiries-table.tsx` and `/enquiries` page.** `FilterBar` search + chips as links (`Needs attention`, `New`, `Sourcing`, `Waiting supplier`, `Quote ready`, `All`, `Archived`; the `Email` chip is added in Task 8 with its count). Columns: Ref (mono `ENQ-00012`), Source (channel label), Customer or requester, Requirement (first item description, `+N more`, else subject), Items (`confirmed/total`, pending highlighted), Status, Priority, Age (`FreshnessBadge` from `observedAt`). Stretched-link name cell. Empty states: "Nothing needs attention. Add an enquiry." and "No enquiries yet. Paste a customer request." with a "New enquiry" primary action; header action "New enquiry".

- [ ] **Step 4: Navigation.** In `config/navigation.ts` add the group `Enquiries` (items Enquiries `/enquiries` with `Inbox` icon, Customers `/customers` with `Users` icon) between Overview and Procurement; update the comment. In `navigation.test.ts` change the future-route assertion list from `["/enquiries", "/sourcing", "/rfqs", "/quotations", "/agents"]` to `["/sourcing", "/rfqs", "/quotations", "/agents"]` and add nothing else.

- [ ] **Step 5: Overview.** Add a compact "Enquiries needing attention" list (ref, customer/requester, requirement, status, age; rows link to the workspace; empty text "Nothing needs attention.") beside the existing two lists, following the existing Overview markup. Read `app/(workspace)/page.tsx` first and keep its layout conventions.

- [ ] **Step 6: Customer Enquiries tab.** Replace the temporary table from Task 3 with `EnquiriesTable` fed by `listEnquiries({ view: "all", customerId, page: 1 })`.

- [ ] **Step 7: Verify.** Typecheck, lint, `npm run test -- navigation` (an existing test, run once, not extended). `curl` `/enquiries`, `/enquiries?view=all`, `/`, and `/customers/<id>?tab=enquiries` (200).

---

## Task 7: Email accounts

**Files:** `core/security/secret-box.ts`, `modules/email/{schemas,imap,account.service,queries,actions}.ts`, `components/{account-form,accounts-table,account-actions}.tsx`, `app/(workspace)/settings/email/page.tsx`, `settings-nav.tsx`, `package.json`, `next.config.ts`.

- [ ] **Step 1: Read the Next 16 docs** for `serverExternalPackages` (name and location in `next.config.ts`) and for server-only modules. Install: `npm install imapflow postal-mime`. Add `serverExternalPackages: ["imapflow", "postal-mime"]` to `next.config.ts`. Confirm the versions installed and that they load under Node (`node -e "require('imapflow')"` / `import('postal-mime')`).

- [ ] **Step 2: `secret-box.ts`** (no imports from the app; `node:crypto` only):

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.APP_SECRET_KEY?.trim();
  if (!raw) throw new Error("APP_SECRET_KEY is not configured");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("APP_SECRET_KEY must be 32 bytes, base64 encoded");
  return buf;
}

export function isSecretKeyConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 3: `schemas.ts`.** `emailAccountBaseSchema`: `label requiredText("Label", 100)`, `host` (trimmed, lower-cased, matches `/^[a-z0-9.-]+$/`, 3-253 chars), `port` (int 1-65535), `security` enum `EmailSecurity`, `username requiredText("Username", 254)`, `folder requiredText("Folder", 200)` default `INBOX`, `syncFromDate` (`yyyy-mm-dd`, not in the future). `emailAccountCreateSchema` adds `password` (required, 1-500, **not trimmed**). `emailAccountUpdateSchema` adds `id` and optional `password` (blank = keep). `emailAccountTestSchema` = base fields + optional `id` + optional `password`. `emailAccountStatusSchema`. `emailSyncSchema` (`id`). All `z.output` types exported.

- [ ] **Step 4: `imap.ts`** (relative imports only; server only):
  - `openClient(cfg)` builds `new ImapFlow({ host, port, secure: security === "SSL_TLS", doSTARTTLS: security === "STARTTLS" ? true : undefined, auth: { user, pass }, logger: false, tls: { rejectUnauthorized: true }, socketTimeout: 30_000 })`. **`logger: false`** so credentials never reach logs.
  - `describeImapError(error): string` maps to a short sanitised message: `authenticationFailed` -> "Sign-in failed. Check the username and password."; `ENOTFOUND` -> "The mail server address was not found."; `ECONNREFUSED`/`ETIMEDOUT` -> "The mail server could not be reached."; certificate/TLS codes -> "The server's security certificate could not be verified."; mailbox missing -> "That folder was not found."; anything else -> "The mail server returned an error." The raw error is never returned or stored, and the password never appears in any message.
  - `testImapConnection(cfg)`: connect, `getMailboxLock(folder, { readOnly: true })`, read `client.mailbox.exists`, release, `logout`; returns the result union from the registry; always closes the connection.

- [ ] **Step 5: `account.service.ts`.** `createEmailAccount`: require `isSecretKeyConfigured()` (else `InvariantError("APP_SECRET_KEY is not set. Add it to .env and restart.")`); `normalizedKey = [host.toLowerCase(), username.toLowerCase(), folder].join("|")`; unique conflict -> `ConflictError("This mailbox is already connected.")`; store `encryptSecret(password)`; audit `email_account.created` with `{ label, host, port, security, username, folder }` (**no password**). `updateEmailAccount`: diff `label, host, port, security, username, folder, syncFromDate`; when a new password is supplied re-encrypt and write a separate audit `email_account.password_changed` with **no details**; changing host/username/folder resets the cursor (`uidValidity = null, lastUid = null`). `setEmailAccountStatus` audits `email_account.status_changed`. Diffs never include the password.

- [ ] **Step 6: `queries.ts`.** `listEmailAccounts()` with an explicit `select` that omits `passwordEncrypted`, plus a message count per account via `_count`. `getEmailAccountForSync(id)` (used only by sync and test-connection) selects `passwordEncrypted`. Add a comment on both stating the rule.

- [ ] **Step 7: Actions.** `createEmailAccountAction`, `updateEmailAccountAction`, `setEmailAccountStatusAction`, and `testEmailConnectionAction(_prev, formData)`: validates `emailAccountTestSchema`; if the password is blank and an `id` is given, decrypts the stored password (via `getEmailAccountForSync`); calls `testImapConnection`; returns `ok({ messageCount })` or `fail(message)`. The sync action is added in Task 8.

- [ ] **Step 8: Components.** `account-form.tsx` (drawer): label, host (default `imap.hostinger.com`), port (default `993`), security select (default SSL/TLS), username, password (`type="password"`, `autoComplete="off"`, placeholder "Leave blank to keep the current password" when editing, never prefilled), folder (default `INBOX`), sync-from date (default 7 days ago in Dubai), a Test connection button (submits the form via `formAction` to the test action and shows the inline result), and a notice explaining read-only access and encrypted storage. If the key is not configured (`isSecretKeyConfigured()` passed as a prop from the page), the form is replaced by an inline explanation. `accounts-table.tsx`: Label, Mailbox (`username @ host`), Folder, Last sync (`FreshnessBadge` or "Never"), Last result (OK / error text), Messages, Status, actions (Edit drawer, Test, Status control via `RecordStatusControl`). `account-actions.tsx`: Test button (client) for a saved account.

- [ ] **Step 9: Settings page and nav.** Add `Integrations > Email accounts` (`/settings/email`) to `settings-nav.tsx`. `settings/email/page.tsx`: `listEmailAccounts()`, "Add account" drawer, empty state "No email accounts yet. Add the mailbox that receives customer enquiries.".

- [ ] **Step 10: Verify.** Typecheck, lint. `curl /settings/email` (200). With a scratchpad script: encrypt/decrypt round-trip; decrypt of a tampered payload throws; `testImapConnection` against an unreachable host returns the sanitised message (no raw error text). Create a `TEST` account through the service with a dummy password and read the row directly: `password_encrypted` starts with `v1:` and does not contain the dummy password; confirm `listEmailAccounts()` results have no `passwordEncrypted` key and the audit rows contain no password. **Ask the user to add their real Hostinger account through the screen** and press Test connection (Task 8 needs it).

---

## Task 8: Email sync, scoring and triage

**Files:** `modules/email/{text,mime,sync.service,triage.service,filters}.ts`, `scoring/{config,score}.ts`, `queries.ts` (messages), `actions.ts` (sync/triage), components, `enquiries/page.tsx` (Email chip), `emails/[id]/raw/route.ts`, `scripts/mail-sync.ts`, `package.json`, `README.md`.

- [ ] **Step 1: `text.ts`** (pure): `htmlToText(html)` (drop `script`/`style`/`head` blocks, turn `br`, `p`, `div`, `tr`, `li`, `h1-6` boundaries into newlines, strip remaining tags, decode `&nbsp; &amp; &lt; &gt; &quot; &#39;` and numeric entities, collapse runs of blank lines to one). `stripQuotedForScoring(text)` = the lines before `visibleLineCount` from `enquiries/parsing/quoted`.

- [ ] **Step 2: `mime.ts`.** `normalizeEmail(raw: Buffer): Promise<NormalizedEmail>` using PostalMime (`PostalMime.parse(raw)`): `messageId`, `inReplyTo`, `referencesHeader`, `fromName`, `fromAddress` (lower-cased), `to`, `cc` (arrays of `{ name, address }`), `subject`, `sentAt`, `textBody` (`email.text` when present and non-blank, else `htmlToText(email.html)`), `attachments` (`{ filename, contentType, size }[]`, no content), `hasListUnsubscribe` (header `list-unsubscribe` present), `autoSubmitted` (header `auto-submitted` other than `no`). Also `renderEvidenceText(email, receivedAt)`: `From: …\nTo: …\nCc: …\nDate: …\nSubject: …\n\n<textBody>` (this is the `EvidenceSource.rawText`, so the enquiry workspace's raw pane and line numbers refer to it). On a PostalMime failure the caller records a parse-error row (see Step 5).

- [ ] **Step 3: `scoring/config.ts`** (typed constants; one place to tune): weights `subjectRfq 30, intent 15, knownCustomer 15, knownBrand 10, knownCategory 10, specPattern 10, quantity 5, attachmentName 10, marketing -40, recruitment -40, newsletter -30, automatedSender -30, knownSupplier -30`, thresholds `likely 70, review 40`, phrase lists:
  - `RFQ_SUBJECT`: `request for quotation|request for quote|rfq|quotation request|quote request|price request|need quotation|enquiry|inquiry|boq|bill of quantities|please quote|kindly quote`
  - `INTENT`: `please quote|kindly quote|kindly send|we require|we need|we are looking for|looking for|requirement|supply of|urgently need|require your best price|best price`
  - `MARKETING`: `limited time offer|click here|% off|special offer|winner|act now|exclusive deal|free trial`
  - `RECRUITMENT`: `resume|curriculum vitae|\bcv\b|vacancy|job opening|hiring|job application|candidate`
  - `NEWSLETTER`: `unsubscribe|view in browser|newsletter|webinar|manage your preferences`
  - `ATTACHMENT_NAME`: `rfq|boq|bom|quotation|enquiry|inquiry|requirement|tender`
  - `AUTOMATED_SENDER`: `no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce`

- [ ] **Step 4: `scoring/score.ts`** (pure): 

```ts
export type ScoreInput = { subject: string | null; visibleText: string; fromAddress: string | null; attachmentNames: string[]; hasListUnsubscribe: boolean; autoSubmitted: boolean };
export type ScoreContext = { brands: string[]; categories: string[]; families: string[]; knownCustomer: boolean; knownSupplier: boolean };
export function scoreEmail(input: ScoreInput, context: ScoreContext): { score: number; band: EmailBand; reasons: { label: string; points: number }[] }
```
Each rule that fires pushes `{ label, points }` with a human label (e.g. `Subject contains "please quote"`, `Sender is a known customer`, `Brand "Dell" mentioned`). `knownBrand`/`knownCategory` use `findBrand` (broadcast extractors) and a word-boundary category match; `specPattern` uses `findSpecs`; `quantity` uses `findRequestedQuantity`. The sum is clamped to 0-100 and mapped to a band by the thresholds.

- [ ] **Step 5: `sync.service.ts`** (relative imports only). `syncAccount(ctx, accountId)`:
  1. Load the account with the encrypted password; require `status === "ACTIVE"`. **Lease**: `updateMany({ where: { id, OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }] }, data: { syncLeaseUntil: now + 5 min } })`; `count === 0` -> `ConflictError("A sync is already running for this account.")`.
  2. In `try/finally` (always clears the lease and writes `lastSyncAt`, `lastSyncStatus`, `lastSyncError`): connect, `getMailboxLock(folder, { readOnly: true })`; read `uidValidity`; if it differs from the stored one, reset `lastUid`. `search({ since: syncFromDate }, { uid: true })`, keep UIDs greater than `lastUid`, sort ascending, take 200 (`remaining = more exist`).
  3. For each UID: `fetchOne(uid, { source: true, internalDate: true }, { uid: true })`. Skip if a row for `(account, folder, uidValidity, uid)` exists. Build the message inside its own `inTransaction`: `normalizeEmail` (on failure, a parse-error row: `parseError` = a short sanitised reason, `textBody` = "", evidence text "(This message could not be read. The original is preserved.)", band LOW, score 0); if `messageId` already exists for the account, skip it as a duplicate; if `rawSize > 20 MB`, `rawSource = null`; create the evidence via `createEvidence(c, { kind: "CUSTOMER_EMAIL", channel: "EMAIL", rawText: renderEvidenceText(...), observedAt: receivedAt })`; compute the score using `ScoreContext` built from the master lists, `findKnownCustomerByEmail(fromAddress)`, and a known-supplier check (`supplierContact.email` or `supplier.email` equal to the sender, case-insensitive, not archived); create `EmailMessage`. Advance `lastUid` after each successfully stored message.
  4. After the loop, if `ingested > 0` write one audit `email_account.synced` `{ ingested, skipped, errors }`. Return the result. Errors in `catch` are stored through `describeImapError`; **never** store or log the raw error or password. Per-message failures increment `errors` and continue.

- [ ] **Step 6: `triage.service.ts`.**
  - `createEnquiryFromEmail(ctx, emailId)`: transaction; load the message (must be `NEW`, else `InvariantError("This email has already been handled.")`); `known = findKnownCustomerByEmail(fromAddress)`; call `createEnquiry(c, { source: { kind: "existing", evidenceSourceId }, customerId: known?.customerId ?? null, contactId: known?.contactId ?? null, requesterName: known ? null : fromName, requesterEmail: known ? null : fromAddress, subject, notes: null })`; update the email to `ENQUIRY_CREATED` with `enquiryId`; audit `email_message.enquiry_created` (scope `Enquiry`).
  - `dismissEmail`: requires a non-blank reason (`ValidationError`), sets `DISMISSED`, `dismissedAt`, `dismissedById`, `dismissedReason`; audit `email_message.dismissed`.
  - `restoreEmail`: only from `DISMISSED` to `NEW`, clearing the dismiss fields; audit `email_message.restored`.

- [ ] **Step 7: Queries and filters.** `listEmailMessages({ band: "likely-review" | "all" | EmailBand, status: EmailTriageStatus, page })` (default band Likely+Review, status NEW), selecting `id, receivedAt, fromName, fromAddress, subject, band, score, scoreReasons, attachments (count), triageStatus, dismissedReason, enquiryId`, excluding `rawSource` and `textBody`; `getEmailMessage(id)` for the drawer (includes `textBody`, headers, attachments, reasons, account label; still excludes `rawSource`); `countEmailTriage()` = band in (LIKELY, REVIEW) and status NEW; `getEmailRaw(id)` selects `rawSource`, `subject`, `rawSize` for the download only. `parseEmailFilters(searchParams)`.

- [ ] **Step 8: Actions.** `syncEmailAccountAction` (`syncAccount`, success message "Synced N new messages" / "No new messages", a `remaining` note; revalidate `/enquiries`, `/settings/email`, `/`), `createEnquiryFromEmailAction` (returns `{ id: enquiryId }`), `dismissEmailAction`, `restoreEmailAction`.

- [ ] **Step 9: UI.** In `/enquiries` add the `Email` chip with the `countEmailTriage()` count; when `view=email` render `EmailTriageTable` (Received, From, Subject, band badge, top two reason labels with the full list in the title, attachment count, actions) with filters (band select, state select) and a "Sync mail" button per active account (`SyncButton`, client, pending state). Row click opens `?email=<id>` -> `EmailDrawer` (server-rendered `Sheet` like `EvidenceDrawer`): headers, clean text (mono, wrapped), score breakdown list, attachments, `Download .eml`, and actions `Create enquiry` (on success `router.push('/enquiries/<id>')`), `Dismiss` (popover with a required reason), `Restore`. Add `EMAIL_BAND` badge (`LIKELY` success, `REVIEW` warning, `LOW` muted) to `status-badges.tsx`. On Overview, the attention list's header links to `/enquiries?view=email` with the triage count when > 0.

- [ ] **Step 10: `.eml` route.** `app/(workspace)/emails/[id]/raw/route.ts` (`GET`): validate the uuid, `getEmailRaw`, 404 when missing, 404 with a plain text note when `rawSource` is null (too large), else return the bytes with `Content-Type: message/rfc822` and `Content-Disposition: attachment; filename="<safe subject>.eml"` (strip everything except `[A-Za-z0-9 ._-]`, max 80 chars, fallback `email`). Read the Next 16 route-handler docs first.

- [ ] **Step 11: `scripts/mail-sync.ts` and scripts.** Load env the same way `scripts/db-backup.ts` does; for every ACTIVE account run `syncAccount({ actor: <system actor>, db }, id)` and log one line per account (`label`, counts; never credentials). `--watch` repeats every `MAIL_SYNC_INTERVAL_MINUTES` (default 5), handling errors per account and shutting down cleanly on SIGINT. The audit actor for the script is the development user (`getServiceContext()`), so `email_account.synced` rows show that user. Add to `package.json`: `"mail:sync": "tsx scripts/mail-sync.ts"`. Document both modes in `README.md` (env vars, "Email" section, read-only note).

- [ ] **Step 12: Verify.** Typecheck, lint. Scratchpad script: `scoreEmail` on (a) an RFQ-style subject/body with a known brand and quantity (expect LIKELY), (b) a newsletter with `List-Unsubscribe` (expect LOW), (c) a recruitment mail (expect LOW); print the reasons and read them. `normalizeEmail` on a small hand-written `.eml` string (multipart with an HTML part and an attachment header) and check `textBody`, attachment metadata and no attachment content. Then, with the user's real account added: **Test connection**, **Sync now**, confirm rows and bands, run **Sync now** a second time and confirm nothing new is ingested, and confirm with the user that nothing in the mailbox was marked read. Create an enquiry from a `LIKELY` email and dismiss/restore another. `curl` the `.eml` route and check the first bytes are the message headers. If the user has not added an account yet, stop here and report exactly which of these were not exercised.

---

## Task 9: End-to-end check and documentation

- [ ] **Step 1: Run the Definition of Done** (`CURRENT.md` section 17) items 1-14 in order. Anything created is labelled `TEST` and listed to the user at the end so it can be removed. Items that need a real browser or the user's mailbox are reported as **verified by me** or **not verified** individually; do not claim what was not run.
- [ ] **Step 2: Whole-project checks.** `npm run typecheck`, `npm run lint`, `npm run build`; run the existing test suite once (`npm run test`) and report the result (existing tests are kept, not extended).
- [ ] **Step 3: Documentation** per `CURRENT.md` section 18: `DATA_MODEL.md` (new tables, guards, the email evidence note that `raw_text` is the rendered text and the MIME is in `email_messages.raw_source`), `docs/modules/ENQUIRIES.md` (status, what was built, what is deferred), `SCREENS.md` (Settings sidebar, Enquiries, Customers, Email triage), `OVERVIEW.md` if it lists modules, `BACKLOG.md` (reply threading, SMTP, attachment content, supplier-email-to-broadcast, dictionary editor, key rotation, quoted-text handling improvements), `README.md`, and `CURRENT.md` section "Implementation Status" in the style of the previous plan (built, verified, not verified, known limitations).

---

## Execution notes (2026-09-20)

Executed inline in one session. Deviations from the plan as written, all small:
- **Task 2:** the Email accounts menu item was added in Task 7 (not Task 2), so no menu entry pointed at a missing page.
- **Task 3:** the customer Enquiries tab was added in Task 6 instead of a throwaway table in Task 3.
- **Task 4:** `EnquiryParseContext` gained an optional `skipLeadingLines`, `visibleLineCount` a `startAt` argument, and `quoted.ts` two helpers (`emailHeaderLineCount`, `emailSubjectLineIndex`). Needed so an email's rendered header block is not parsed as requirements or mistaken for a quoted reply. `createEnquiry` falls back to the subject line when the body holds nothing.
- **Task 5:** split into `service.ts`, `item.service.ts` and `shared.ts`; `EnquiryStatusBadge` / `PriorityBadge` were added here instead of Task 6. A one-click "confirm without editing" action was dropped (the editor's Confirm covers it).
- **Task 6:** enquiry age is plain relative time, not the supplier `FreshnessBadge` (its "Stale" wording is wrong for a waiting customer); the customers table follows.
- **Task 7:** `HOSTINGER_IMAP_DEFAULTS` and `defaultSyncFromInput` live in `email/schemas.ts`. The failed-form echo of `runAction` would have sent the password back to the browser, so the email actions strip it first (`withoutPassword`).
- **Task 8:** `ingestMessage` is exported so the storage, scoring and de-duplication path could be exercised with a stand-in IMAP client. `dismissEmail` also refuses a blank reason itself. The Email view lists stored emails even when no mailbox is active. `src/modules/email/queries.ts` holds the message queries too.
- **Whole project:** the three settings pages use `connection()` because Next otherwise prerendered them at build time with a database snapshot.

## Self-review

**Spec coverage:** Settings shell (Task 2), Customers (3), enquiry data model and DB guards (1), parser (4), workspace, header suggestions, supplier intelligence, timeline, customer-from-requester (5), inbox, navigation, Overview (6), accounts and security (7), ingestion, scoring, triage, `.eml` download, polling script (8), audit actions (1 and each service), verification and docs (9). Out-of-scope items are not planned. The spec's "Test connection" is in Task 7; the "sync-from" bound, 200 cap, lease and de-duplication are in Task 8 Step 5.

**Placeholder scan:** no TBD/TODO. Where a step says "copy the X pattern", the named file exists and is read first; field lists and function names are given.

**Type consistency:** names in the registry are used unchanged in the tasks (`createEnquiry` with `EnquirySource`, `enquiryRulesParser`, `visibleLineCount`, `findKnownCustomerByEmail`, `getItemIntelligence`, `syncAccount`, `scoreEmail`, `createEnquiryFromEmail`). Enum values match the Prisma block (`EmailBand`, `EmailTriageStatus`, `EnquiryStatus`, `EnquiryPriority`).

**Deliberate deviations from the template:** no tests or commits (project rules); DB changes use `migrate diff` + `migrate deploy` so no shadow database is created.
