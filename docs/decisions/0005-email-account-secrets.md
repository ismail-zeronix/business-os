# 0005. Mailbox credentials: encrypted at rest, write-only, read-only mailbox access

**Status:** Accepted (2026-09-20). Approved by the user as security-sensitive before implementation.

## Context
The Enquiry Intelligence milestone ingests customer email over IMAP. That needs a mailbox username and password, stored so a background sync can use them, in an application that has no login yet (ADR 0004). The mailbox also holds real customer correspondence.

## Decision
1. **Encryption at rest.** The password is stored in `email_accounts.password_encrypted` as AES-256-GCM, a random 12-byte IV per value, formatted `v1:<iv>:<tag>:<ciphertext>` (base64). The key is `APP_SECRET_KEY` (32 bytes, base64) in `.env`, never in the database. Without the key the account form is disabled and explains why.
2. **Write-only.** The password is entered once and never displayed. "Replace password" writes a new value; a blank field on edit keeps the stored one. The encrypted column is excluded (explicit `select`) from every query except the sync and test-connection services. It never reaches the browser, logs, error messages or audit details. Audit records only that a password changed.
3. **Read-only mailbox access.** The folder is opened read-only (IMAP EXAMINE). Nothing is marked read, flagged, moved or deleted.
4. **Transport.** `SSL/TLS` or `STARTTLS` only; certificate validation is always on. IMAP client logging is disabled so credentials cannot reach logs.
5. **Errors are sanitised.** Connection failures are mapped to a short category ("Sign-in failed", "The mail server could not be reached"...). The raw error is neither shown nor stored.
6. **Real email is evidence.** Each message is stored immutably (database trigger) and therefore also appears in `db:backup` dumps. A dump does not contain a usable password, because the key is not in the database.

## Consequences
- Losing or changing `APP_SECRET_KEY` makes stored passwords undecryptable; they must be re-entered. There is no key rotation yet (BACKLOG).
- The host and port come from the form and the server connects to them. That is acceptable only while the app is unauthenticated **and** bound to localhost.
- **Authentication becomes a hard prerequisite** before anyone other than the developer uses the application: Settings can change the mailbox, and the inbox shows customer email.
