# Screens — Supplier & Broadcast Intelligence MVP

Per-screen specification for the **current milestone only**. Rules and tokens: `UI_SYSTEM.md`. A screen is ticked in `CURRENT.md` only when it exists and works; there are no placeholder screens.

> **Layout note (design v2).** The ASCII mock-ups below predate the app shell described in `UI_SYSTEM.md` ("App shell"). Wherever one shows a title row or a button above a table (`SUPPLIERS ... [ + Add supplier ]`), read it as: the title is the navbar breadcrumb, the button is on the right of the top navbar, and the table sits in a flush panel with its tabs and filter pills on top.

## Navigation
```
Business OS logo (mark only when collapsed to the icon rail)

Overview

ENQUIRIES
  Enquiries        (count: needing attention)
  Customers
  Quotations

PROCUREMENT
  Suppliers
  Broadcasts       (count: awaiting review)
  Products

ADMIN
  Audit
  Settings
```
Future modules (RFQs, Agents) are **absent**, not disabled. The shell is a white shadcn sidebar plus a white top navbar with breadcrumbs, record status chips and the page's buttons (see `UI_SYSTEM.md`, "App shell"). The sidebar footer shows the signed-in person and their role. There is no global Create menu, and no global Ctrl+K search; the **Search** screen (Procurement group) is the one search entry point.

## Sign in, setup, account and users (2026-09-21, ADR 0006)
**Sign in `/login`** and **Set up sign-in `/setup`** sit outside the app shell: a small centred card under the Business OS mark, no sidebar, no data. *Sign in*: Email, Password, **Sign in**. A wrong answer is always "Email or password is not correct, or the account is temporarily locked."; the email stays, the password field is cleared. `?next=` (a path inside this site only) is followed after signing in. Without a session every other page and route redirects here. If nobody has a password yet it redirects to /setup; if already signed in it goes to the app. *Set up*: available only while no active admin has a password (then it redirects to /login). Your name, email, password (at least 10 characters) and again; it takes over the existing user account (history stays with the same person), makes it admin and signs in.

**Before setup** the app opens as it always did (the development user acts) and shows a slim amber strip under the navbar: "Sign-in is not set up: anyone who can reach this application has full access. Set up sign-in" (also in the account menu).

**Account menu** (top navbar, right): name and role ("Not signed in" before setup). Menu: name, email and role; **Settings** (admins only); **Audit log**; **Change password** (a right-hand drawer: current, new, again; your other sessions are signed out, this one stays); **Sign out** (to /login). After any error the password fields are cleared and must be typed again: a password is never sent back to the browser.

**Staff** (the non-admin role) see no Settings in the sidebar or menu; opening a Settings address goes to `/forbidden` ("Only an admin can open this", with a way back). Everything else works as for admins.

**Settings > Users `/settings/users`** (admins only; the "Access" group of the settings sidebar). Table: Person (name, email, a "You" tag), Role (Admin / Staff), Status, Last sign-in ("No password set: cannot sign in", "Never", a relative time, "Locked until ..."), Actions: **Edit** (drawer: name, email, role; your own role is fixed), **Reset password** (drawer: a new password for them, ends their sessions and clears a lock), **Deactivate / Reactivate** (not on your own row; deactivating ends their sessions). Navbar: **Add user** (drawer: name, email, role, an initial password you give them). The last active admin cannot be deactivated or demoted.

## Overview `/`
A monitor, not a workspace (design v3): what needs a person now, how the business is moving, and the lists behind the numbers. Every figure is derived from real records (`src/modules/overview`); nothing is estimated. All controls are in the top navbar. Top to bottom:
1. **Four work-queue cards** (each a link to where the work is done; second line = how long the oldest item has waited): Enquiries to review (`/enquiries`), Awaiting supplier reply (`/?tab=waiting`, sourcing requests sent and not answered), Broadcasts to review (`/broadcasts`, with pending item count), Emails to triage (`/enquiries?view=email`). They are a list in `queue-cards.tsx`; a new queue is one more entry.
2. **Three charts** (inline SVG and CSS bars, no chart library, each with a text summary): *Enquiries received* (bars per day for the chosen period, change vs the previous period), *Pipeline by stage* (New, In progress, Quote ready or quoted, Won, Lost, with the win rate won / (won + lost); "Unknown" while nothing is closed), *Supplier price freshness* (latest price per product and supplier in the freshness bands of `lib/freshness.ts`).
3. **Enquiries needing attention** (wide table, reuses the enquiries table with the quick-view drawer, `?peek=`) beside a **tabbed card** (`?tab=`): Waiting on suppliers (default), Broadcasts, Latest prices (evidence drawer, `?evidence=`), Emails. Each tab has a "view all" link to where that list is worked.

Navbar (right): **Charts** period (Last 7 / 30 / 90 days, `?range=`, affects the charts only), **Sync now** (one per active mailbox; only when a mailbox exists), **New broadcast**, **New enquiry**, then the bell and account menu. There are no buttons, search box or filters in the page body. Empty states: "Nothing needs attention", "No supplier is being waited on", "Nothing to review", "No observations yet", "No emails to triage", "No enquiries in this period", "No supplier prices yet".

## Suppliers `/suppliers`
Filters: search, status, type, brand, category.
```
SUPPLIERS                                                        [ + Add supplier ]
[ Search suppliers... ]  Status v   Type v   Brand v   Category v

Supplier            Type          Brands        Categories    Location   Payment   Last evidence   Status
ABC Computers       Stockist      Dell, HP +1   Laptop, Desk  Dubai      30 days   2h ago          Active
```
Row click opens detail; "+ Add supplier" opens the drawer. Empty: "No suppliers yet. Add your first supplier." Archived hidden unless the status filter includes them.

## Supplier detail `/suppliers/[id]?tab=`
Header: name, "Type · Location", status badge, Edit (drawer).
- **Overview**: profile (KeyValue), brand and category chips (edit inline), terms and notes.
- **Contacts**: table (name, title, phones, email, brands/categories, preferred channel, status) + add/edit drawer + archive. Empty: "No contacts for this supplier."
- **Broadcasts**: this supplier's broadcasts with review progress.
- **Prices / Stock**: latest observation per product (price, VAT, stock, age, evidence icon). Also serves as the supplier's product list.
- **Activity**: timeline from the audit log (supplier, its contacts, its broadcasts).

## Broadcasts `/broadcasts`
Table: Received · Supplier · Contact · Items · Review progress (confirmed / pending) · Created by. Filter chips: Needs review (default) · All · Archived. Empty: "No broadcasts yet. Paste your first supplier message."

## New broadcast `/broadcasts/new`
Compact form: Supplier (combobox) · Contact (combobox, filtered by supplier, optional) · Channel (Manual paste default / WhatsApp / Email / Other) · Received at (default now, Dubai time) · Raw message (large mono textarea). Saving preserves the raw text, runs the parser, and lands in the review workspace. A duplicate-paste warning (same supplier, same text hash) allows proceeding.

**Supplier and contact read from the message (2026-09-21).** The supplier's WhatsApp lists end with `SUPPLIER : NAME` and `CONTACT : NAME` lines (labels: supplier / company / vendor, and contact / attn / attention; the last one in the text wins). As you type or paste, the form picks the **Supplier** when **exactly one** supplier has that name (its short name or its legal name, ignoring case, spacing, punctuation and a trailing LLC / LTD / FZE...), then the **Contact** the same way among that supplier's contacts. A partial name never matches, and none or several matches pick nothing. A small note says "Read from the message: supplier X, contact Y." When nothing fits it warns instead: no supplier has exactly that name (pick one or add it under Suppliers), more than one has it, the supplier has no contact with that name, or the message names a different supplier or contact than the one you chose. A supplier or contact chosen **by hand (or by @) is never replaced**; one that was read from a message is replaced when a new message names another. In a reply to a sourcing request the supplier stays the request's. Nothing is created.

**@ mentions in the message box (2026-09-21).** The same lines can be filled with a list instead. Type `@` after `SUPPLIER :` (or `COMPANY :`) and a small list under the caret shows the suppliers, narrowing with every letter (contains-match, names that start with the letters first, up to 8). Type `@` after `CONTACT :` (or `ATTN :`) and it lists **that supplier's** contacts (before a supplier is chosen it says to choose the supplier first). An `@` at the very start of a line also offers suppliers. Arrow keys move, **Enter** or **Tab** picks, **Escape** closes, a click works too. Picking writes the name into the text and sets the **Supplier** or **Contact** field above it; picking a different supplier drops a contact of the previous one. The fields still work by hand. An `@` in a price (`Dell 5440 @ 2450`) or an email address never opens the list. The text stays exactly as typed and pasted (it is the evidence).

**As a reply to a sourcing request** (`/broadcasts/new?supplier=&request=`, opened by **Record reply** on an enquiry's Sourcing tab): titled "Record reply", the supplier is pre-filled, an info notice says which enquiry it answers, a hidden field links the saved broadcast to the request (which becomes Replied), and Cancel returns to the enquiry's Sourcing tab. An unknown or archived-enquiry `?request=` is ignored and the form is the plain one. The saved broadcast is reviewed as any other, and its header shows a **Reply to ENQ-00012** pill linking back to the Sourcing tab.

## Broadcast review `/broadcasts/[id]?item=` — the key screen
Split view, no modal stack.
```
Acme Trading · Ahmed · WhatsApp · 20 Sep 2026 09:14        7 items · 4 confirmed · 2 pending · 1 ignored
[ All | Pending | Confirmed | Ignored ]                                            [Confirm N ready items]

RAW BROADCAST (sticky, mono)          EXTRACTED ITEMS
 1  Dell 5440                         > Dell Latitude 5440     25 pcs   AED 2,450 Excl. VAT   In stock   Exact    Pending  [Confirm][Edit][Ignore]
 2  i7 16/512                         v Dell Latitude 5440  (expanded, inline editor)
 3  DOS                                 Description [.....]  Brand [Dell v]  Model [5440]  Part no. [...]
 4  25pc ready                          Spec [i7 16/512 DOS]  Qty [25]  Price [2450] Currency [AED v]  VAT [Excl. v]  Stock [In stock v]
 5  2450+                               Product [ Dell Latitude 5440 (LAT5440-...)  v ]   candidates first · search · [Create product]
 6  UAE                                 [x] Remember "Dell 5440" as an alias        [Confirm  Ctrl+Enter] [Ignore]
                                      > Lenovo V15 G4 ...
```
- The raw pane shows line numbers; the selected item's source lines are highlighted. The reviewer never loses the source.
- Collapsed row: status, description, qty, price + VAT, stock, match badge, actions. Expanded row: inline editor and product picker.
- Product picker: pre-linked match first (with basis), other candidates, search, **Create product** (right drawer prefilled from the item).
- Confirmed items are read-only with **Reopen** (confirm popover: "This retracts the price and stock observations created from this item").
- "Add item" adds a manual item (optionally from selected raw text). Currency defaults visibly to AED when a price exists; the reviewer confirms it.
- **Confirm N ready items** (next to the filter pills): confirms every pending item already linked to an active product in one click, behind a small popover explaining what "ready" means. Items still needing a product link stay in the individual flow.

## Search `/search?q=` (2026-09-20)
Procurement search: one box (part number, model, alias or words). Matched products, exact and probable hits from the matcher first with a label ("Exact · Part number"), then the word matches; at most 20, with the total and "add a word to narrow it" when there are more. Each product is a block: name, part number, brand, category, Temporary badge, alias chips, then the supplier table (supplier, latest price with VAT, latest stock, freshness, evidence icon that opens the evidence drawer). A product with no observations says so. No cross-supplier best price. Empty query and no-match states point at the next action.

## Products `/products`
Single search (name, description/specs, model, part number, alias, brand) + brand / category / temporary / status filters.
```
Product                              Supplier              Brand    Category   Model   Part Number   Suppliers   Latest observation   Status
Lenovo V15 G4 IRU  83A100SUAK        SUPERTECH COMPUTERS    Lenovo   Laptop     V15G4   83A100SUAK    2           2h ago                Confirmed
```
"+ Add product" opens a drawer. Empty: "No products match. Add a product or paste a broadcast."

## Product detail `/products/[id]`
Identity (name, brand, category, family, model, part number, SKU, status, temporary flag), aliases (add/remove), then:
```
SUPPLIER INTELLIGENCE                                              [ Show history ]
Supplier          Price                  Stock       Observed        Evidence
ABC Computers     AED 1,450  Excl. VAT   Ready       2h ago          [ ]
XYZ Trading       AED 1,475  Unknown     30 pcs      1d ago          [ ]
```
Latest price and latest stock are independent per supplier. "Show history" reveals all observations including retracted (struck-through). No cross-supplier ranking. Empty: "No supplier observations for this product."

## Evidence drawer `?evidence=<observationId>`
Server-rendered right drawer, shareable URL. Shows: supplier and contact, channel, observed-at (Dubai time), the full raw broadcast with the item's source lines highlighted, extracted vs corrected values (from `extracted_data`), linked product and match basis, retraction info, and "Open broadcast".

## Audit `/audit`
Read-only table: Time · Actor · Action · Entity · Details. Filters: entity type, actor, date range. Paginated.

## Settings `/settings` (route-based, updated 2026-09-20)
A thin secondary sidebar (about 176px) lists every setting: **Master data** > Brands `/settings/brands`, Categories `/settings/categories`; **Integrations** > Email accounts `/settings/email`. `/settings` redirects to Brands (and the old `?tab=categories` to Categories). Add a menu item only when its page exists; unbuilt settings are absent, not disabled. Brands and Categories: inline add, rename, archive.

### Email accounts `/settings/email`
Table: Label, Mailbox (username, `host:port · SSL/TLS`), Folder, Last sync (with **Sync now** for active accounts), Last result (OK, or a short sanitised error), Messages, Status, Edit / Status. "Add account" opens a drawer: label, mail server (pre-filled `imap.hostinger.com`), port (`993`), security (SSL/TLS, STARTTLS; unencrypted is not offered), folder (`INBOX`), username, password, sync-from date (default a week ago), **Test connection**. The password is write-only: never shown, never pre-filled, blank on edit keeps the stored one. Without `APP_SECRET_KEY` the form explains what is missing instead. Empty: "No email accounts yet. Add the mailbox that receives customer enquiries."

## Navigation additions (2026-09-20)
Group **Enquiries**: Enquiries, Customers (between Overview and Procurement). Overview gains a compact "Enquiries needing attention" list with a "N emails to triage" link.

## Enquiries `/enquiries`
Operational inbox, not a Kanban board. Tabs (URL `?view=`): Needs attention (default: status NEW or any pending requirement, open only), New, Sourcing, Waiting supplier, Quote ready, All, Archived, **Email** (with a count of emails waiting).
```
Ref        Source   Customer     Requirement                 Items        Status   Priority  Age
ENQ-00012  Email    ABC LLC      Dell Latitude 5440 +2 more  1/3 2 pending New     Urgent    14 min ago
```
Search (reference, customer, requester, requirement). Age is from when the customer sent it, shown as plain relative time (not the supplier "stale" bands). Empty states are specific to each tab and point at the next action.

**Email view** (`?view=email`): triage queue. Filters: band (Likely and review by default, all, low only) and state (waiting by default, enquiry created, dismissed). Columns: Received, From, Subject, Likelihood badge, Why (top rules), attachment icon, State. **Sync now** per active mailbox next to the filters. A row opens the email drawer (`?email=<id>`): headers, score breakdown (each rule with its points), attachment names and sizes, the text as plain text, **Create enquiry** / **Dismiss** (reason required) / **Restore**, and **Download original (.eml)**. Stored emails stay reachable even when the mailbox is deactivated.

## New enquiry `/enquiries/new`
Customer (optional, searchable), contact (filtered by customer), requester name and email (shown when there is no customer), received via, received at (Dubai time), the request (large mono textarea), subject, notes. Saving preserves the text exactly, runs the parser and opens the workspace.

## Enquiry workspace `/enquiries/[id]?item=&view=` (key screen)
Navbar: breadcrumb `Enquiries > ENQ-00012`, chips for status, priority and pending count, and the buttons Add requirement, **Status** (popover with note), Archive, Save as customer (unknown requester only) and Edit. A **Detected in the request** strip offers delivery and urgency as suggestions with **Apply** (nothing is saved until applied; required-by wording is a hint only). Below it an enquiry panel (customer, contact, requester, subject, received, required by, delivery, owner, blocker, next action, notes) (its Edit and Save as customer buttons are in the navbar).

Tabs: **Requirements** (default), **Sourcing** (count of suppliers asked) and **Activity** (add a note; timeline of every change from the audit log, including the sourcing events).

**Sourcing** (`?view=sourcing`, 2026-09-21): a one-line summary (`N asked · N waiting · N replied · N confirmed requirements in the message`), **Add supplier** (right-hand drawer: supplier picker with suggested suppliers first and the reason, then an optional contact) and a compact table:
```
Supplier            Status   Sent               Reply                         Note   Actions
TEST Supplier A     Replied  Email · 4 min ago  Reply · just now · 1 item            View message  Record another reply
TEST Supplier B     Sent     WhatsApp · now     No reply yet                         View message  Record reply  No stock / Declined
```
Actions by status: Draft = **Prepare message** (drawer: subject and message, each with **Copy**, channel and sent time, **Mark sent**), **No stock / Declined** (popover with a note), **Remove**. Sent = **View message** (the stored text, read-only, with Copy), **Record reply**, No stock / Declined. Replied = View message, **Record another reply**. No stock / Declined = View message, Record reply, **Reopen**. **Record reply** opens `/broadcasts/new?supplier=&request=`. Empty states: "Confirm a requirement first" (link to Requirements) and "No suppliers asked yet". A note says how many pending requirements are not in the message. An archived enquiry shows the table read-only: no Add supplier, no actions except View message.

**Compare** (below the requests table, only when at least one supplier is on the enquiry): a heading and one line ("Latest price and stock from each supplier, as they stated it. Nothing is ranked; you choose."), then a table with one row per confirmed requirement (name, quantity, linked product) and one column per supplier (name and request status pill). Cells reuse the product page's price and stock cells (amount, VAT badge, stock badge, age, evidence icon). Under each cell: **Choose** (or **Choose instead** when another supplier is chosen); a popover with an optional note saves the choice. The chosen cell is tinted and shows a **Chosen** pill, **Clear**, the note, "by Name · age", and, only if the supplier's latest values differ from what was chosen, a **When chosen** block with the original price and stock and their evidence links. A supplier marked No stock or Declined says "Marked No stock: cannot be chosen." and has no button. A requirement with no product shows "Link a product to compare" and "—" cells. Archived enquiry: choices shown, no buttons.

Requirements is a split view like broadcast review: the raw request on the left (line numbers, the selected requirement's source lines highlighted; for an email, the header block and text, with **Download original (.eml)**), the requirements on the right with filter chips (all / pending / confirmed / ignored) and `j` / `k` navigation. A selected pending requirement expands to the product linker (candidates, search, **Create product**), the inline editor (requirement, brand, family, model, part number, specification, quantity, notes; **Confirm** or Ctrl+Enter, **Save**, **Ignore requirement**), detected chips (cpu, ram, storage, os) and "How this was read". Confirmed or ignored requirements are read-only with **Reopen**. Every selected requirement shows **Supplier intelligence**: for a linked product the latest price and stock per supplier with VAT, age and an evidence link (the same table as the product page), otherwise "Link a product to see the latest supplier prices and stock"; plus the active suppliers who handle the brand.

## Customers `/customers` and `/customers/[id]`
List: Customer, Location, Contacts, Open enquiries, Last enquiry, Status; search and status filter. Detail tabs: Overview, Contacts (add, edit, archive; an email address here is what recognises the customer in incoming mail), **Enquiries** (this customer's enquiries, "New enquiry" shortcut), Activity.

## Quotations `/quotations`, `/quotations/[id]` and `/quotations/[id]/print` (2026-09-21)
**List** `/quotations`: flush panel, search (a reference such as `QUO-20260921-0001`, `20260921-0001`, or just the counter `1`, an `ENQ-` number, customer, attention, item text) and a status filter (default Draft and issued; Superseded on request; `?enquiry=` narrows to one enquiry). Columns: Quotation (`QUO-20260921-0001`: the day it was made and that day's counter, `rev 2` from the second revision), Customer, Enquiry (link), Status pill, Lines, Total incl. VAT (a warning `*` when some lines are not priced yet), Valid until, Updated. The row is the link. Empty states: "No quotations yet" (with a link to enquiries) and "No quotations match these filters".

**Manual quotation** (no enquiry): **New quotation** on the list opens a drawer with a saved customer (searchable) or a typed customer name, and an optional attention name; **Create draft** opens the quotation, which says "Manual quotation" and "None: a manual quotation" as its enquiry. The list shows "Manual" in the Enquiry column.

**Add line** (drawer, two options). **From a supplier confirmation** (default), for when a supplier has just confirmed a price by phone or message: *Product* (Existing product: search by name, model, part number or alias and **Use**; or New product: name, brand, model, part number, created as a temporary product), *Supplier and how they confirmed* (supplier, who you spoke to, Confirmed by Phone call / WhatsApp / Email / Manual entry / Other, when, and a required **Note** that is kept as the record), *What they confirmed* (price per unit, currency, VAT, optional stock quantity and status) and *On this quotation* (quantity for the customer, optional markup %). **Record confirmation and add line** saves everything in one go; errors appear inline and nothing is saved on error. **Typed line**: description, quantity, price (no supplier, no cost). The evidence drawer for such a cost says "Direct confirmation (typed in, with a note)", the channel and the written record.

**Made from the enquiry.** The enquiry's action bar shows a link to each current quotation (`QUO-20260921-0001 · Draft`) and **Create quotation** (a popover says what it does). Create is disabled until a requirement is confirmed, absent while a draft exists, and absent on an archived enquiry.

**Quotation** `/quotations/[id]` (internal screen): breadcrumb `Quotations > QUO-20260921-0001`, status pill. Navbar buttons: for a draft **Edit details** (drawer), **Add line** (drawer, for delivery and the like), **Preview customer copy** (opens the print page in a new tab) and **Issue** (popover: checks completeness, then freezes; a failure lists everything still missing); for an issued or superseded quotation **Download PDF** (opens the customer copy and the print dialog straight away: choose Save as PDF) and, on an issued one, **Revise** (popover); a superseded one links to the current revision. Only an issued or superseded quotation gets a one-line banner (who and when; a link to the current revision). Below: a **summary strip** on one row (customer, attention, enquiry, currency and VAT, valid until, revisions; "Not set" in amber when missing), with a folded **Terms, notes and history** section that previews its contents in one line; the **lines table**; one totals card in two halves; and a folded **Activity** section with a count. The internal columns (cost, markup, margin) are shaded, with one line under the table ("Shaded columns are internal and never printed") and a folded **How pricing works** note. Folding uses the shared `CollapsibleSection` (native `<details>`, no script).
```
#  Description          Qty  Cost (internal)                      Markup %  Unit price  Total     Margin (internal)  Actions
1  Dell Latitude 5440   2    AED 2,300 VAT excl.                    10.00     2,530.00    5,060.00  460.00            Save  refresh  remove
                            TEST Supplier B · 2 days ago · evidence
2  TEST Delivery        1    No cost on record                      (off)     50.00       50.00     —                 Save  remove
```
In a draft each row is a small form: description and part number, quantity, markup %, unit price. **Changing the markup sets the price and changing the price sets the markup** (live in the browser, decided again by the server on Save). Markup is disabled, with a tooltip, when the cost is unknown or in another currency than the quotation (there is no conversion), and the row says so. The refresh icon takes the cost again from the supplier now chosen for that requirement. Issued and superseded quotations show the same table read-only. Totals: **Customer totals** (subtotal excl. VAT, VAT, total; a note when lines are not counted) and **Margin (internal, never printed)** (revenue, cost, margin and its % over the lines that have a quantity, a price and a cost in the quotation's currency, and how many lines that is; "Unknown" when none). The evidence link on a cost opens the evidence drawer (`?evidence=`).

**Print** `/quotations/[id]/print` (outside the app shell, still needs sign-in): a grey desk with white A4 paper and a toolbar (**Back to quotation**, **Print / Save as PDF**, a hint to choose Save as PDF in the print dialog) that is hidden when printing. The paper is a plain business document in the Business OS colours (deep green text, green rules), with no boxes, pills or decoration. Header: the small Zeronix logo, the legal name, and rows with a location, mail and phone icon (address on two lines, emails and phones each on one line with a divider), from `src/config/company.ts` (the TRN prints once filled in); on the right the word Quotation with reference, date and valid until. Then "Quotation for" the customer and attention, the lines table (description and part number, quantity, unit price, total), the amount in words on the left with subtotal, VAT and a semi-bold total on the right, payment and delivery terms and notes, the **Sales representative** (who issued it, or made the draft), and a footer with the Business OS mark and "Created using Business OS by Zeronix Technology LLC". It shows **no supplier, cost, markup or margin**: the page reads only `getQuotationForPrint`, whose select does not include them. A draft prints with "Draft: not issued" and a superseded revision with "Superseded by a later revision". The page title (`Quotation QUO-20260921-0001`) is the suggested PDF file name.

## Settings > Email accounts: Outgoing, and Email quotation (2026-09-21)
**Settings > Email accounts** (admin only) has two tabs. **Incoming** is the IMAP inbox as before. **Outgoing** shows **Your signature** (a textarea with the suggested text in grey until you save one; each person has their own) above a table of outgoing accounts (Label, Sends as with the default Bcc, Server, Last test, Status, Actions: **Send test email** (a popover with the address, prefilled with yours), Edit, Status). **Add account** opens a drawer in three parts: *Server* (label, SMTP host, port, security; Hostinger prefilled), *Login* (**Same login as an incoming mailbox**, whose password is copied on the server, or **Type a login**), and *Sent as* (From name and address, Reply-To, Default Bcc). Only one account is active; activating another deactivates the first.

**Send by email** (topbar of an issued quotation, next to Download PDF; disabled with an explanation when no outgoing account exists) opens a right-hand drawer:
```
From      Zeronix Technology LLC <info@zeronix.ae>            (read-only)
To        [ahmed@abc.ae x]  type or paste...                   (chips; Enter, comma, semicolon or space adds one)
          + Ahmed  + Sara                                      (the customer's contacts, one click)
          Add Cc   Add Bcc                                     (reveal the fields; the default Bcc is prefilled)
Subject   Quotation QUO-20260921-0001 from Zeronix Technology LLC
Message   Dear Ahmed, ... Terms in brief - prices in AED excl. VAT, payment, delivery, validity ...
Signature (yours)                                  [Save as my signature]
[PDF] Quotation-QUO-20260921-0001.pdf   Preview
The PDF is attached when you press Send.            [Cancel] [Send email]
```
A wrong address stays in the box with a message. A failure (sign-in, server unreachable, refused address) shows as plain text at the top of the drawer and nothing is marked sent. On success: a toast and the drawer closes. The quotation page gains a folded **Emails sent** section (count and last recipient in its header; each row shows Sent or Failed, recipients, subject, who, when and the exact PDF attached).
