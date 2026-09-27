# Broadcasts: things to consider

**Status:** DRAFT
**Purpose:** A checklist and the common mistakes to avoid when adding and confirming supplier messages, so the price and stock knowledge stays trustworthy.
**Sources:** the application's documentation (docs/modules/BROADCASTS.md). Business habits marked TO BE FILLED come from the owner and are not yet written.

## Before you save

- The right **supplier**: the exact one who sent it. A price saved under the wrong supplier is a wrong price.
- The right **received at** time. Freshness is counted from it, so an old message saved as "now" looks fresher than it is.
- Paste the **whole** message, unedited, including the supplier and contact lines at the end.
- One supplier per broadcast. Do not paste two suppliers' messages together.
- If the app warns the same text was already saved, look at the earlier broadcast before saving again.

## While you review

- **Product link first.** A price on the wrong product is worse than no price. When two products look alike, compare the specification text and pick the one that matches.
- **VAT:** a trailing `+` after a price (for example `2450+`) is read as "excluding VAT". That is a market habit and only a proposal: confirm it with the supplier if the price matters. When VAT is not stated it stays unknown.
- **Currency:** the app never assumes one when reading. At confirm a missing currency is recorded as AED. If the message is in another currency, set it before confirming.
- **Quantity:** "25pc ready" is a quantity of 25 and stock in hand. Sizes like 16GB are not quantities. If a quantity is not written, leave it blank.
- **Stock wording** ("ready", "available", "limited", "incoming", "on request", "out of stock") is read into a stock status. Check that it matches what the supplier meant, especially "incoming" versus "ready".
- **Warranty** is read when written (for example 1YR, 3YR, on-site, carry-in, next business day). If it is not written it stays unknown; never assume one.
- **Lists with no prices** only tell you the supplier carries those products. Confirming them records "available", not a price.
- If you are **not sure**, do not confirm. Leave the item pending, or ignore it with a reason. A pending item costs nothing; a wrong confirmed price misleads a quotation.

## After you confirm

- A mistake is never edited away. **Reopen** the item, which retracts its records, correct it, and confirm again. The history shows what happened.
- Do not use **Confirm N ready items** as a shortcut around checking. It confirms everything already linked to a product, right or wrong.
- Prices age. Before quoting a customer, look at how old the price is and re-ask the supplier if it is old.

## Common mistakes

| Mistake | What to do instead |
|---|---|
| Retyping or tidying the message before pasting | Paste it as it arrived; the original is the evidence |
| Picking a supplier with a similar name | Choose the exact supplier, or add the correct one under Suppliers |
| Confirming an item linked to a look-alike product | Compare the specification text and relink |
| Assuming a price is AED or excludes VAT | Check the message; confirm with the supplier if unclear |
| Pasting a screenshot or PDF expecting it to be read | Only text is read; type the lines that matter |
| Deleting a wrong broadcast | Use Archive broadcast (it can be restored); fix wrong items with Reopen |

## Things to confirm

- TO BE FILLED: How soon after a supplier message arrives it must be added and reviewed.
- TO BE FILLED: How old a price may be before it must be re-checked with the supplier (see broadcasts-and-price-checks).
- TO BE FILLED: Who to ask when a product, brand or category is missing from the lists.
- TO BE FILLED: How the team names suppliers and contacts so the message footer matches exactly.

## Unknowns

- The items under "Things to confirm" are unknown. Do not assume them; ask.
