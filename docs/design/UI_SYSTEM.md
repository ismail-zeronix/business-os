# UI System

Rules for every screen. Per-screen layouts for the current milestone are in `SCREENS.md`. Build to this file; change it deliberately, not per screen.

> **Design v2 (2026-09-20) is the system.** The look was reworked from two style references (a CRM table with filter chips and soft pills; a card UI with a detail side panel), taking only the style, never the content. Where this file still describes the older v1 look (32px rows, 4-6px radii, no top bar, bordered badges), the v2 rules in sections 2 and 5 win.

> **Design v3 (2026-09-20) supersedes v2 where they differ.** Restyled from the Business OS reference (green theme). Global changes, all made through tokens in `globals.css`: **Plus Jakarta Sans** replaces Geist Sans (Geist Mono stays for part numbers); `--radius` is **12px** (`rounded-lg` buttons, inputs, menus), cards and panels are `rounded-xl` (16px), chips, filter pills, tabs and the Overview's primary button are `rounded-full`; the **sidebar is deep green** (`--sidebar`, active item a solid `--sidebar-primary` pill, white text) and the top navbar is the canvas colour with no border, a bell (dot when enquiries need attention) and the account menu; `--primary` is the **lime call-to-action** (dark text on it) and the new `--brand` mid green carries links, active icons, selected chips and selection tints (lime text on white is unreadable); `--canvas`, borders, muted and surface tones are green-tinted; `info` is cyan so it stays distinct from success green. The type scale gains `text-2xl` (30px, KPI figures) and `text-3xl` (34px, page title on the canvas), so the old 24px cap no longer applies. Layouts of the other screens are unchanged (flush list panels, record cards). The **Overview** is the one screen with the v3 dashboard layout (work-queue cards, three charts, an attention table beside a tabbed list card; all controls in the navbar; see `SCREENS.md`). Its figures are computed from real records (`modules/overview`); enquiry value, AI qualification score and quote actions from the reference are deliberately absent because the data does not exist.

## 1. Principles
Premium, thin, compact, enterprise, information-dense, fast. **Tables first.** One accent colour. Colour carries meaning only. No decoration.

Avoid: oversized SaaS cards, giant type, gradients, large radii, animation for its own sake, decorative dashboards and KPI tiles, emoji used as icons, fake screens for future modules.

**Built on shadcn/ui, not around it.** Surfaces, tabs, pills, avatars, breadcrumbs, the sidebar and alerts are the shadcn components (`Card`, `Tabs`, `Badge`, `Avatar`, `Breadcrumb`, `Sidebar`, `Alert`, `Sheet`, `Table`, `Command`, `Popover`, `DropdownMenu`, `Select`, `Input`, `Button`) re-skinned through tokens. The application components in `src/components/application` are thin domain wrappers over them. Do not hand-roll a card, badge, tab strip or alert with utility classes; add a variant to the shadcn component instead.

## 2. Tokens
Defined once as CSS variables in `src/app/globals.css` (`@theme` in Tailwind v4). shadcn/ui components are re-skinned through these tokens, **not forked**. Values below are the starting point; change them in one place.

| Token | Value | Use |
|---|---|---|
| `--background` / `--surface` | white / zinc-50 | page / sidebar, table header, panels |
| `--foreground` / `--muted-foreground` | zinc-900 / zinc-500 | text / metadata |
| `--border` | zinc-200, **1px** | all borders |
| `--primary` / `--brand` | lime `#b4e64e` (dark text) / mid green `#2a8a4a` | v3: `primary` is the call-to-action button; `brand` is links, active icons, selected chips, the Overview's selected-row tint. (shadcn's own `--accent` is only the subtle hover surface.) |
| `--surface` | zinc-50 | quiet panels, table headers, sidebar |
| `--radius` | **12px** (v3), the single knob. `rounded-lg` = cards, panels, tables, buttons, inputs, menus; `rounded-md` (4px) = pills and chips | nothing in the app sets a pixel radius by hand; change `--radius` and everything follows |
| `--color-canvas` | `#ffffff` | the page background and the top navbar (white; record-page cards separate with their ring and shadow) |
| shadow | `--shadow-panel` (hairline) on cards; `--shadow-float` on popovers and drawers | depth only where something is a surface or floats |
| spacing | 4px grid | gaps 4/8/12/16/24 |
| control height | 28px xs, 32px sm, 36px default | buttons (`xs` / `sm` / default), inputs and selects 36px (sm 32px) |
| table row | 48px, header 40px, hairline dividers | lists (avatar and two-line cells need the room) |
| layout | see "App shell" below: white sidebar 256px, white top navbar 56px, content area fills the rest. Drawer 480px. | |

Light theme only for this milestone. Tokens are semantic (`--fresh`, `--danger`, ...), so a dark theme is an additive change (BACKLOG).

Semantic tones are tokens `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, each with `-bg` and `-border` variants (used as `text-success`, `bg-success-bg`, `border-success-border`); `neutral` is the muted zinc set. Tailwind's `text-xs / sm / base / lg / xl` are remapped to 12 / 13 / 15 / 22 / 24px so every component inherits the scale, and the radius steps above `lg` are only 8-14px and only used where a shadcn component asks for them; nothing is pill-shaped except avatars.

### App shell (design v2)
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
- **Sidebar** (shadcn `Sidebar`, white, hairline right edge): a header row as tall as the navbar so the two hairlines line up, holding the Business OS logo (the flower mark drawn as SVG in `components/application/brand-mark.tsx`, with the wordmark as text beside it when open; the PNGs in `public/brand/` are no longer used), groups with small uppercase labels, the active item a light grey pill with an accent icon, amber count badges for work waiting (enquiries needing attention, broadcasts awaiting review), the acting user in the footer. It **starts collapsed** as a 68px icon rail that shows **only icons** (logo mark, 22px nav icons with tooltips, avatar; no labels, group headings or user text) and opens with the navbar toggle or Ctrl+B (no edge handle: it overlapped the page and drew a hover strip). Opening reveals the wordmark with a short framer-motion animation (the mark makes one turn with the petals popping in, the wordmark slides out; reduced-motion users get none). Icons keep the same position in both states, labels are clipped by the sidebar's own width (`overflow-hidden`) rather than swapped, so nothing spills or slides while the width animates. It is a sheet on small screens and remembers its state in the `sidebar_open` cookie (collapsed when there is none). Count badges become a small dot on the icon in the rail. Items come from `config/navigation.ts`; future modules are absent, never disabled.
- **Top navbar** (white, 56px, hairline bottom edge): sidebar toggle, shadcn `Breadcrumb` (every ancestor a link; the trail comes from the route, or from the page for a record: `Procurement > Suppliers > ABC Computers`), the record's status chips, then the **page's buttons on the right**, then the account menu. There is no global "Create" menu.
- **No headings on the canvas.** A page never draws its own title, subtitle or section caption above its content: the navbar and the sidebar already say where you are, and the tabs say what a list is. `PageHeader` keeps the title as screen-reader text and registers the breadcrumbs, chips and buttons with the navbar (`TopbarActions` and `TopbarMeta` render into it through a portal). **Buttons never sit above a table**: "New enquiry", "Add contact", "Sync now", "Show history", "Add account" all live in the navbar and appear only on the tab or page they belong to.
- **Content area** (`main`; the workspace layout adds no padding). Two page shapes:
  - *List pages* (Overview, Enquiries, Suppliers, Customers, Products, Broadcasts, Audit): one `<Panel flush>` that fills the frame edge to edge, with no margin, radius or shadow, so the sidebar, navbar and content read as one white surface separated by hairlines. Inside it: `PanelTabs` (icons, count chips, amber when something waits), a toolbar row (`FilterBar`: search plus `FilterPill`s), the table, and `Pagination` as the panel footer.
  - *Record pages* (supplier, customer, product, enquiry, broadcast, forms, settings): an optional flush `TabNav` strip under the navbar, then a `PageBody` (the grey canvas with a 24px gutter) holding cards (`PanelSection`, `Panel`, `TableShell`).
- Layers: white chrome (sidebar, navbar, list panel) > grey canvas (record pages only) > white card > quiet inner surface (`zinc-50`).

## 3. Typography
Geist Sans for UI, **Geist Mono** for part numbers, SKUs and raw broadcast text. Loaded with `next/font`.

| Role | Size / weight |
|---|---|
| Page title | 22px / 600 (max 24px anywhere) |
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
| `PageHeader` | Registers the page with the navbar: breadcrumbs, status chips (`meta`), buttons (`actions`); title and subtitle are screen-reader only. One primary button per page. |
| `Panel` / `PanelSection` / `PageBody` | shadcn `Card` surfaces. `Panel flush` = a list page's edge-to-edge surface; `Panel` = a card with no padding (tables, tab strips); `PanelSection` = a padded card with a small uppercase caption; `PageBody` = the grey padded canvas for record pages. |
| `PanelTabs` / `TabNav` | shadcn `Tabs` (line variant) whose triggers are links, so the tab lives in the URL. `PanelTabs` sits at the top of a panel (icon, count chip); `TabNav` is for record pages (`flush` = a white strip under the navbar). Only for sections that exist. |
| `DataTable` | Plain semantic table built on the shadcn `Table`. 48px rows, 40px header, hover highlight, two-line cells with an initials avatar where a person or company is the subject, numeric columns right-aligned, server-side sort/pagination. No client-side filtering of large sets. |
| `FilterBar` / `FilterPill` | The toolbar row of a list panel: search input plus `FilterPill`s (a pill that opens a searchable checkbox list, multi or single; state in the URL). Clear appears when any filter is active. |
| `SoftPill` / `InitialsAvatar` | shadcn `Badge` (24px, 4px radius, pastel tint, no border) and `Avatar` (initials, colour derived from the name). Tone meanings live in `status-badges.tsx`. |
| `Alert` | shadcn `Alert` with `success`, `info`, `warning`, `danger` variants for banners and form-level messages. |
| `Pagination` | Page size 25 (50 optional), "x-y of n". |
| `Drawer` (right `Sheet`, 480px) | Create/edit forms and secondary detail. Preferred over modals. Never stack drawers. URL-driven drawers (`?peek=` enquiry quick view, `?evidence=`, `?email=`) all use `UrlSheet`: a shadcn `Sheet` with the standard header and close button, and a shareable, back-button-safe URL. The quick view brings its own full-height layout: key facts, requirements, actions, recent activity. |
| `Combobox` | Searchable select (Popover + Command). Used for supplier, contact, product, brand, category. Server-searched when the list can be large. |
| `KeyValue` | Dense definition list for profiles (label muted 11-12px, value 13px, "Unknown" when empty). |
| `Timeline` | Activity: time, actor, action, short detail. |
| `EvidencePanel` | Supplier, contact, channel, observed-at, raw text with highlighted source lines, extracted vs corrected values. |
| `EmptyState` / `ErrorState` / `LoadingState` | See section 8. |
| Badges | See section 6. 24px pastel chips (12px text), no border. |
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
- [ ] No text above 24px; body 13px; tables 12-13px
- [ ] No hand-set radii (everything follows `--radius`); no gradients; no decorative cards or KPI tiles
- [ ] No heading or button row on the canvas: titles come from the navbar breadcrumbs, buttons sit in the navbar
- [ ] Cards, tabs, badges, avatars and alerts are shadcn components, not hand-rolled classes
- [ ] Numbers right-aligned and tabular; part numbers in mono
- [ ] Unknown shown explicitly; stale and retracted visible but de-emphasised
- [ ] Loading, empty and error states present
- [ ] Filters and tabs in the URL; pagination server-side
- [ ] Keyboard path works (search, drawers, review)
- [ ] Only one primary action per page; destructive actions confirm
- [ ] No fake or disabled screens for future modules
