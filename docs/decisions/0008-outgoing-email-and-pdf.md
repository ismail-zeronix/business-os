# 0008. Outgoing email and server-made PDFs

**Status:** Accepted (2026-09-21). Approved by the user before implementation: headless Chrome for the PDF, and a sample email to their own address.

## Context
Quotations were shown and printed, but not sent. Emailing one needs a real PDF file on the server and a way to send mail. Sending email is outward-facing and security-sensitive: it needs a stored mailbox password and it puts business documents in front of customers.

## Decision
1. **PDF by headless browser.** A Chrome, Chromium or Edge already installed on the machine (path in `PDF_BROWSER_PATH`) prints the existing print page. One template, so the PDF is what the screen shows. Dependency: `playwright-core` (no browser is downloaded).
2. **The browser has no session.** The server opens its own page on its own address (`APP_INTERNAL_URL`, default `http://127.0.0.1:3000`, never the request's Host header) with a signed token: HMAC-SHA256 over `render:<quotation id>:<expiry>`, keyed by `APP_SECRET_KEY`, valid two minutes, for the read-only print page only.
3. **SMTP with `nodemailer`.** One outgoing account is active at a time. Its password is encrypted and write-only exactly as the incoming mailbox's (ADR 0005), decrypted only inside the service that sends. A new account can copy an incoming mailbox's login on the server; the password is not shown or sent to the browser. Certificates are always validated. Errors become one plain sentence; the server's raw reply is never shown or stored.
4. **Sending is always a person's explicit act.** Only an ISSUED quotation can be emailed, only from the compose drawer's Send, only to addresses that person typed or picked. Nothing sends automatically, on schedule, or on issue.
5. **Sent mail is a record.** `sent_emails` stores recipients, subject, text and the exact PDF attached, and cannot be updated or deleted (trigger). A failed attempt is stored too. Sending is audited on the quotation and the customer.
6. **No tracking pixel.** No open or click tracking: unreliable, harmful to deliverability and a privacy problem.
7. **Per-person signature.** Stored on the user, editable only by that user (the service uses the actor's own id), added under emails they send.

## Consequences
- The app must run where a Chrome, Chromium or Edge is installed; a container needs one added.
- Anyone signed in can email an issued quotation (no separate permission yet); admins configure the account.
- The signed token means a leaked URL is usable for two minutes for one read-only page.
- A message sent cannot be recalled; the record can only be read.
