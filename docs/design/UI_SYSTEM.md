# UI System

Rules for every screen. Per-screen layouts for the current milestone are in `SCREENS.md`. Build to this file; change it deliberately, not per screen.

> **v4 (2026-10-08) supersedes all prior versions.** The previous v1/v2/v3 banners in this file had drifted from each other and from the
> shipped code (white sidebar vs. deep green, 4px pill radius vs. `rounded-full`, lime buttons vs. lime-as-indicator, "no headings on canvas"
> vs. the planned record header, Geist Sans vs. Plus Jakarta Sans, 56px navbar vs. the shipped 64px). This revision is the single source of
> truth: every rule below is checked against the actual code, and every contradiction above is resolved in the sections that follow.

## 1. Principles

Premium, thin, compact, enterprise, information-dense, fast. **Tables first.** Colour carries meaning only. No decoration.

Avoid: oversized SaaS cards, giant type, gradients, large radii, animation for its own sake, decorative dashboards and KPI tiles, emoji used as icons, fake screens for future modules.

**Built on shadcn/ui, not around it.** Surfaces, tabs, pills, avatars, breadcrumbs, the sidebar and alerts are the shadcn components (`Card`, `Tabs`, `Badge`, `Avatar`, `Breadcrumb`, `Sidebar`, `Alert`, `Sheet`, `Table`, `Command`, `Popover`, `DropdownMenu`, `Select`, `Input`, `Button`) re-skinned through tokens. The application components in `src/components/application` are thin domain wrappers over them. Do not hand-roll a card, badge, tab strip or alert with utility classes; add a variant to the shadcn component instead.

## 2. Tokens

Defined once as CSS variables in `src/app/globals.css` (`@theme` in Tailwind v4). shadcn/ui components are re-skinned through these tokens, **not forked**. Values below are the starting point; change them in one place.

| Token | Value | Use |
|---|---|---|
| `--background` / `--card` | white / white | page background (unused directly; see `--color-canvas` below) / cards, popovers — explicit white so cards visibly pop off the tinted canvas |
| `--color-canvas` | `#F7FAF7` (faint green tint) | the page background and the top navbar; cards separate themselves from it because `--card` is explicitly white, not inherited from canvas |
| `--surface` | `#f8fbf8` | quiet inner panels: table headers, sidebar-adjacent asides, hover tints — a shade between `--card` (white) and `--muted` |
| `--foreground` / `--muted-foreground` | `#10241a` / `#66776d` | text / metadata (already at the documented target; no change needed) |
| `--border` | `#e3eae4`, **1px** | all borders (already at the documented target; no change needed) |
| `--brand` | mid green `#2a8a4a` | **the primary-action colour**: button fills (`Button`'s `default` variant), links, active icons, selected chips, the Overview's selected-row tint |
| `--primary` | lime `#b4e64e` (dark text) | **indicator/accent only** — never a button fill. Sidebar active-state ring, attention dots, count badges, selected-state chips, occasional high-priority emphasis |
| `--radius` | **12px**, the single knob for non-pill surfaces | `rounded-lg` = cards, panels, tables, buttons, inputs, menus. Governs cards/panels/inputs only — see section on shape below for pills/chips/tabs |
| shadow | `--shadow-panel` (hairline) on cards; `--shadow-float` on popovers and drawers | depth only where something is a surface or floats |
| spacing | 4px grid | gaps 4/8/12/16/24 |
| control height | 28px xs, 32px sm, 36px default | buttons (`xs` / `sm` / default), inputs and selects 36px (sm 32px) |
| table row | 48px, header 40px, hairline dividers | lists (avatar and two-line cells need the room) |
| layout | see "App shell" below | sidebar ~68px collapsed / ~240–248px expanded (Task 2 verifies the exact numbers), top navbar **64px**, content area fills the rest. Drawer 480px |

Light theme only for this milestone. Tokens are semantic (`--success`, `--danger`, ...), so a dark theme is an additive change (BACKLOG).

Semantic tones are tokens `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, each with `-bg` and `-border` variants (used as `text-success`, `bg-success-bg`, `border-success-border`); `neutral` is the muted set. Tailwind's `text-xs / sm / base / lg / xl` are remapped to 12 / 13 / 15 / 22 / 24px so every component inherits the scale; `text-2xl` (30px) is reserved for the Overview's KPI counters only — see section 3.

### Shape: radius vs. pill

Two independent rules, not one knob:

- **`--radius` (12px) governs cards, panels, inputs and tables only** — `rounded-lg` buttons (as a surface shape, not their meaning), inputs, menus, table wrappers. `rounded-xl` (16px) is for cards and panels that want a slightly softer corner than the table shell.
- **Chips, pills, tabs and buttons are `rounded-full`.** This is already shipped (`badge.tsx`'s own comment says "pill-shaped") and is canonical — not a 4px/`rounded-md` radius. Avatars are also `rounded-full`.

Nothing in the app hand-sets a pixel radius; every shape comes from `--radius`, Tailwind's `rounded-full`, or a shadcn component's own scale (`rounded-sm`/`rounded-md` consume Tailwind v4's own `--radius-sm`/`--radius-md` theme vars, not a bug — see `globals.css:85-91`).

### One accent colour, revised: two brand accents + an indicator colour

Superseded. The current rule is: **two brand accents (deep green for identity/sidebar, mid green for primary actions/brand emphasis) plus lime reserved for indicators/attention only; status meaning is carried exclusively by the semantic success/warning/danger/info tokens, never by brand colour.** A button being brand-green or a sidebar item being deep-green never means "success" or "error" — only the semantic badge/alert tokens do that.

### App shell

```
+-----------+---------------------------------------------------------------------+
| Zeronix   | [=] Enquiries > Customers > ACME LLC (Active)   [Status] [Edit] [+ Add] (DU) |
|-----------+---------------------------------------------------------------------|
| Overview  | tabs strip, flush, white                                            |
| ENQUIRIES |---------------------------------------------------------------------|
|  Enquiries| toolbar: search, filter pills                                       |
|  ...      | table or list, edge to edge                                         |
| DU  user  |                                                                     |
+-----------+---------------------------------------------------------------------+
```

- **Sidebar** (shadcn `Sidebar`): **deep green** (`--sidebar: #0b4a33`), not white — a header row as tall as the navbar so the two hairlines line up, holding the Business OS logo (the flower mark drawn as SVG in `components/application/brand-mark.tsx`, with the wordmark as text beside it when open; the PNGs in `public/brand/` are no longer used), groups with small uppercase labels, the active item a solid `--sidebar-primary` pill with white text, lime (`--primary`) used for the active-state ring and count badges for work waiting (enquiries needing attention, broadcasts awaiting review), the acting user in the footer. It **starts collapsed** as an icon rail (~68px) that shows **only icons** (logo mark, 22px nav icons with tooltips, avatar; no labels, group headings or user text) and opens (~240–248px; Task 2's job to verify the exact shipped width, not this doc's) with the navbar toggle or Ctrl+B (no edge handle: it overlapped the page and drew a hover strip). Opening reveals the wordmark with a short framer-motion animation (the mark makes one turn with the petals popping in, the wordmark slides out; reduced-motion users get none). Icons keep the same position in both states, labels are clipped by the sidebar's own width (`overflow-hidden`) rather than swapped, so nothing spills or slides while the width animates. It is a sheet on small screens and remembers its state in the `sidebar_open` cookie (collapsed when there is none). Count badges become a small dot on the icon in the rail. Items come from `config/navigation.ts`; future modules are absent, never disabled.
- **Top navbar** (`components/application/topbar.tsx`, **64px** — `min-h-16`, the canvas colour, no border): sidebar toggle, shadcn `Breadcrumb` (every ancestor a link; the trail comes from the route, or from the page for a record: `Procurement > Suppliers > ABC Computers`), the record's status chips, then the **page's buttons on the right**, then the account menu. There is no global "Create" menu. Action hierarchy, left to right: **left** = `☰` toggle + breadcrumb; **middle** = status/context chips; **right** = at most **1 primary action**, up to **2 secondary actions**, then a `•••` overflow menu for anything else. This is a documented rule, not yet enforced everywhere — Quotation detail currently violates it (more than one primary-weight action in the navbar) and is fixed in the task that rebuilds that screen, not this one.
- **Headings on the canvas** — two cases, not one blanket rule:
  - **List pages never draw a visible title.** A list screen (Overview, Enquiries, Suppliers, Customers, Products, Broadcasts, Audit) never draws its own title, subtitle or section caption above its content: the navbar and the sidebar already say where you are, and the tabs say what a list is. `PageHeader` keeps the title as screen-reader text and registers the breadcrumbs, chips and buttons with the navbar (`TopbarActions` and `TopbarMeta` render into it through a portal). **Buttons never sit above a table**: "New enquiry", "Add contact", "Sync now", "Show history", "Add account" all live in the navbar and appear only on the tab or page they belong to.
  - **Record/workspace pages get a visible `RecordHeader`.** This component does not exist yet — a later task builds it. Its title renders at **24px** (`text-[1.5rem]`), inside the page body, not the navbar. This is the one deliberate exception to "no headings on canvas": a record page (supplier, customer, product, enquiry, broadcast workspace) is allowed a real on-page heading because it is the one thing on the page that is not already named by a breadcrumb alone (it carries the record's own identity — name, number, or reference). Until `RecordHeader` ships, record pages keep using the pre-existing `PageBody`/card layout described below.
- **Content area** (`main`; the workspace layout adds no padding). Two page shapes:
  - *List pages*: one `<Panel flush>` that fills the frame edge to edge, with no margin, radius or shadow, so the sidebar, navbar and content read as one surface separated by hairlines. Inside it: `PanelTabs` (icons, count chips, amber when something waits), a toolbar row (`FilterBar`: search plus `FilterPill`s), the table, and `Pagination` as the panel footer.
  - *Record pages* (supplier, customer, product, enquiry, broadcast, forms, settings): an optional flush `TabNav` strip under the navbar, then a `PageBody` (the tinted canvas with a 24px gutter) holding cards (`PanelSection`, `Panel`, `TableShell`) — soon fronted by `RecordHeader` (see above).
- **Right dock** (`components/application/right-dock/`): a 28px icon rail in its own column, each tool with its own icon colour (`DOCK_TONES`) on the right edge (signed-in screens only), so it never covers the page. Each icon (Lucide, tooltip, `aria-label`) opens a **non-modal** panel (24rem, floating under the navbar, no backdrop, thin scrollbars) so the page stays readable and copyable. Esc closes it while focus is inside it, and an opened panel stays mounted so a half-typed draft survives closing. Tools are entries in `dock-registry.ts` (id, label, icon, panel). It is not a `Sheet`: the "never stack drawers" rule is unaffected, and a normal drawer opens above it. The assistant button sits just left of the rail.
- Layers: chrome (sidebar deep green, navbar and list panel on the tinted canvas) > tinted canvas (record pages only) > white card (`--card`) > quiet inner surface (`--surface`).

## 3. Typography

**Plus Jakarta Sans** is canonical for UI text (`src/app/layout.tsx`, loaded with `next/font/google`). **Geist Mono** stays for part numbers, SKUs and raw broadcast text (`geist/font/mono`). There is no Geist Sans anywhere in this app; references to it in older versions of this file were stale.

| Role | Size / weight |
|---|---|
| Record/workspace page title (`RecordHeader`, not yet built) | 24px / 600 (`text-[1.5rem]`) |
| Overview KPI figures | 30px (`text-2xl`) — the one screen that uses this size; it is not a general heading size |
| Section heading | 15px / 600 (uppercase 11px label style allowed for panel captions) |
| Body | 13px / 400 |
| Table cell | 12-13px |
| Metadata, captions | 11-12px, muted |

`font-variant-numeric: tabular-nums` on every number (prices, quantities, counts, ages) and right-align numeric columns. Never let a line exceed ~90 characters in prose.

## 4. Icons

Lucide only, 14-16px, stroke 1.5. No emoji. Every icon-only button has an `aria-label` and a tooltip.

## 5. Component inventory

| Component | Rule |
|---|---|
| `PageHeader` | Registers a list page with the navbar: breadcrumbs, status chips (`meta`), buttons (`actions`); title and subtitle are screen-reader only. One primary button per page. Record pages will instead carry a visible `RecordHeader` (see section 2) once it exists. |
| `Panel` / `PanelSection` / `PageBody` | shadcn `Card` surfaces. `Panel flush` = a list page's edge-to-edge surface; `Panel` = a card with no padding (tables, tab strips); `PanelSection` = a padded card with a small uppercase caption; `PageBody` = the tinted padded canvas for record pages. |
| `PanelTabs` / `TabNav` | shadcn `Tabs` (line variant) whose triggers are links, so the tab lives in the URL. `PanelTabs` sits at the top of a panel (icon, count chip); `TabNav` is for record pages (`flush` = a white strip under the navbar). Only for sections that exist. |
| `DataTable` | Plain semantic table built on the shadcn `Table`. 48px rows, 40px header, hover highlight, two-line cells with an initials avatar where a person or company is the subject, numeric columns right-aligned, server-side sort/pagination. No client-side filtering of large sets. |
| `FilterBar` / `FilterPill` | The toolbar row of a list panel: search input plus `FilterPill`s (a pill that opens a searchable checkbox list, multi or single; state in the URL). Clear appears when any filter is active. |
| `SoftPill` / `InitialsAvatar` | shadcn `Badge` (24px, `rounded-full`, pastel tint, no border) and `Avatar` (initials, colour derived from the name). Tone meanings live in `status-badges.tsx`; the actual tone-to-colour map lives in `soft-pill.tsx` and is kept honest with its name (`blue` renders a sky/blue tint, `indigo` renders an indigo tint — both were mislabelled before v4 and are fixed). |
| `Alert` | shadcn `Alert` with `success`, `info`, `warning`, `danger` variants for banners and form-level messages, sourced from the semantic tokens (`border-success-border bg-success-bg text-success`, etc.). |
| `Pagination` | Page size 25 (50 optional), "x-y of n". |
| `Drawer` (right `Sheet`, 480px) | Create/edit forms and secondary detail. Preferred over modals. Never stack drawers. URL-driven drawers (`?peek=` enquiry quick view, `?evidence=`, `?email=`) all use `UrlSheet`: a shadcn `Sheet` with the standard header and close button, and a shareable, back-button-safe URL. The quick view brings its own full-height layout: key facts, requirements, actions, recent activity. |
| `Combobox` | Searchable select (Popover + Command). Used for supplier, contact, product, brand, category. Server-searched when the list can be large. |
| `KeyValue` | Dense definition list for profiles (label muted 11-12px, value 13px, "Unknown" when empty). |
| `Timeline` | Activity: time, actor, action, short detail. |
| `EvidencePanel` | Supplier, contact, channel, observed-at, raw text with highlighted source lines, extracted vs corrected values. |
| `EmptyState` / `ErrorState` / `LoadingState` | See section 8. |
| Badges | See section 6. 24px pastel chips (12px text). The `success`/`warning`/`danger`/`info` variants now draw a hairline border matching their tint (the same semantic tokens `Alert` uses — `border-success-border` etc.), so a status badge and a status alert for the same meaning render identically. Plain tone chips (`SoftPill`'s `neutral`/`amber`/`sky`/... tones, used for domain-specific vocabularies like enquiry status) stay borderless, unaffected by this. |
| Confirm popover | Small popover for archive / reopen / retract. Not a full modal. |
| Toast (sonner) | Success confirmations only. Errors stay inline. |

## 6. Status and badge vocabulary

One vocabulary so meaning never drifts.

| Domain | Values -> tone |
|---|---|
| Record status | Active (success) / Inactive (neutral) / Archived (neutral, muted) |
| Review | Pending (warning) / Confirmed (success) / Ignored (neutral) |
| Match | Exact (success) / Probable (info) / Confirmed by you (success) / Unmatched (warning) |
| Stock | In stock (success) / Limited (warning) / Available (success, subdued) / Incoming (info) / On request (neutral) / Out of stock (danger) / Unknown (muted) |
| VAT | Incl. VAT / Excl. VAT (neutral) / VAT unknown (muted) |
| Extraction confidence | High / Medium / Low (subtle, neutral) |
| Freshness (from `observed_at`) | under 24h fresh (success) / under 7d recent (neutral) / under 14d aging (warning) / 14d or more stale (muted + "Stale") |

- Freshness bands live in one constant (`lib/freshness.ts`). Age text is `12 min ago`, `3 hours ago`, `Yesterday`, `18 days ago`; the absolute Dubai-time timestamp is in a tooltip.
- **"Unknown" always renders** as muted "Unknown" or an em dash. Never blank, never a guessed value.
- Stale and retracted data stays visible: stale is de-emphasised; retracted is struck-through with a "Retracted" tag.
- The enquiry-status pill vocabulary (`status-badges.tsx`'s `ENQUIRY_STATUS_TONE`) follows: NEW asks for attention (amber); working states are cool colours (`ASSIGNED`/`FOLLOW_UP` sky, `SOURCING` blue — a real sky/blue tint, not lime); with-the-customer states are warm/indigo (`QUOTED` indigo — a real indigo tint, not emerald); outcomes are settled (`WON` green, `LOST` rose).

## 7. Forms

- Compact two-column layout in drawers; labels above, 12px; required marked once. Only genuinely required fields are required.
- Inline field errors from zod; a form-level message for service errors (conflict, not found, database unavailable) in plain language, never stack traces or SQL.
- Submit shows a pending state (`useActionState`); double-submit is prevented.
- Money: amount + currency select (AED default *visibly pre-selected on the review form*) + VAT select. Currency is never hidden.

## 8. States

- **Loading:** layout stays stable; use a thin inline indicator or muted "Loading..." text. No shimmer walls.
- **Empty:** one sentence and the next action ("No suppliers yet. Add your first supplier."). No artwork.
- **Error:** plain message and a retry; log details server-side.
- Every list and detail screen defines all three.

## 9. Interaction and keyboard

`/` focuses search. `Esc` closes drawers/popovers. `Ctrl+Enter` submits a form or confirms a broadcast item. `j` / `k` move between broadcast items. Row click opens the record. Filter, tab, page and selected-item state live in the URL so views are shareable and the back button works.

## 10. Accessibility and density limits

WCAG AA contrast; visible 2px focus ring in the accent colour; full keyboard path through the broadcast review; semantic table markup; labels for all inputs. Desktop-first (design target 1280px and up); panes stack below 1024px but that is not optimised.

## 11. UI review checklist

Run at the end of each stage against the real screens.
- [ ] No heading on canvas on a list page; a record page's title (once `RecordHeader` exists) is 24px, not larger; Overview's KPI counters are the only 30px text on screen; body 13px; tables 12-13px
- [ ] No hand-set radii on cards/panels/inputs (everything follows `--radius`); chips, pills, tabs and buttons are `rounded-full`; no gradients; no decorative cards or KPI tiles
- [ ] No button row on a list page's canvas: titles and buttons come from the navbar
- [ ] Cards, tabs, badges, avatars and alerts are shadcn components, not hand-rolled classes
- [ ] Primary buttons (`Button`'s `default` variant) are brand green, never lime; lime appears only as an indicator (sidebar active ring, count badges, attention dots, selected chips)
- [ ] Numbers right-aligned and tabular; part numbers in mono
- [ ] Unknown shown explicitly; stale and retracted visible but de-emphasised
- [ ] Loading, empty and error states present
- [ ] Filters and tabs in the URL; pagination server-side
- [ ] Keyboard path works (search, drawers, review)
- [ ] Only one primary action per page; topbar right side has at most 1 primary + 2 secondary + a `•••` overflow; destructive actions confirm
- [ ] No fake or disabled screens for future modules
