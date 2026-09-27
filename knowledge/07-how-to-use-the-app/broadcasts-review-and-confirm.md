# Broadcasts: review and confirm

**Status:** DRAFT
**Purpose:** What to do on the review screen after saving a broadcast: check each proposed item, link the right product, and confirm it so it becomes a price or stock record.
**Sources:** the application's documentation (docs/modules/BROADCASTS.md, docs/design/SCREENS.md). Written from the documentation; check the labels against the live screen.

## The review screen

- **Header:** the supplier, contact, channel and the time received, with progress such as "3 pending, 8 confirmed, 1 ignored".
- **Left:** the original message with line numbers. The lines of the item you select are highlighted, so you never lose the source.
- **Right:** the proposed items, one row each: status, description, quantity, price and VAT, stock, how well it matched a product, and the actions.
- **Filters:** All, Pending, Confirmed, Ignored. A **Table** view shows every pending item in one editable table.
- **Keys:** `j` goes to the next item and `k` to the previous one (not while you are typing in a field).

## What "proposed" means

The app reads the message with fixed rules and proposes: brand, model, part number, quantity, price, VAT, currency, stock wording, specification, category and warranty. It never guesses: when something is unclear the field stays empty and the item is marked lower confidence. Nothing is a price or stock record until you confirm it.

## Reviewing one item

1. Select the item and open it to edit.
2. **Check the details** against the highlighted lines: description, brand, model, part number, specification, quantity, price, currency, VAT, stock, category and warranty. Correct anything wrong.
3. **Link the product.** This is the one judgment call. The app shows the best match first with why it matched (part number, model, or a saved alias), then other candidates, a search box, and **Create product**.
   - When several candidates share a name, each shows its own specification text, and words that differ from your item are flagged. Pick the one that really matches (processor, memory, screen).
   - If nothing matches, the app creates a **temporary** product from the item's own text and links it. Check that it is sensible before confirming.
   - Tick **remember this wording as an alias** so the same wording links by itself next time.
4. **Confirm** (or press Ctrl+Enter). The item becomes a price and/or stock record with the original message as its evidence.
5. **Ignore** the item if it is not relevant, optionally with a reason. An ignored item can be reopened.
6. **Add item** creates an item by hand for something the app missed.

## What Confirm records

- Needs a linked, active product, and a price and quantity of zero or more.
- **Price with no currency:** recorded in AED (the business uses one currency). You can fill it in first.
- **No price and no stock wording** (a list of models only): recorded as stock **available** with the quantity left unknown. It means "this supplier lists this product", not a price or a count.
- Both defaults are noted in the audit history.

## Faster ways

- **Table view:** shows every pending item in one table so you can correct fields in bulk, then **Apply all**. It only saves corrections. It never links a product or confirms.
- **Confirm N ready items:** confirms every pending item that is already linked to an active product in one click. Items still needing a product link stay for you to do one by one. Use it only after you have looked at the items.

## After confirming

- A confirmed item is locked. To change it, **Reopen** it: this retracts the price and stock records made from it, then you correct it and confirm again. Nothing is edited or deleted; the history stays.
- Confirmed prices and stock become available in the app: on the supplier's Prices / Stock tab, on the product, in Search, and when working an enquiry's sourcing.
- When every item is confirmed or ignored, the broadcast is finished. To remove a broadcast pasted by mistake, use **Archive broadcast** (it can be restored).

## Things to confirm

- TO BE FILLED: Whether every item must be reviewed the same day, and who checks the reviewer's work.
- TO BE FILLED: When it is acceptable to use "Confirm N ready items".
- TO BE FILLED: What to do when a product is not in the product list and is not worth creating.

## Unknowns

- The items under "Things to confirm" are unknown. Do not assume them; ask.
