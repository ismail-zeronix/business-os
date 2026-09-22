# Confidence scoring

Confidence describes **evidence quality and match certainty**. It is not a promise that the answer is correct. `src/modules/ai/confidence/` is pure TypeScript over database rows, so the same question on the same data gives the same score on every provider.

## Factors

| Factor | Raises | Lowers |
|---|---|---|
| Product identity | Exact part-number match | Generic name only |
| Part number | Present and matched | Absent or partial |
| Specification completeness | Identifying fields present | Sparse product record |
| Evidence quality | A supplier message with a clear line item | Hearsay or a note |
| Stock freshness | Observed hours ago | Observed days ago |
| Price freshness | Recent, within validity | Old or expired |
| Source reliability | Named supplier contact, known supplier | Unverified source |
| Confirmation history | The supplier's earlier confirmations held | Repeated failures |
| Human confirmation | A person confirmed the item | Still PENDING |
| Conflicting data | Sources agree | Sources disagree |

Factors available today are product identity, part number, evidence quality, freshness and human confirmation. The rest are listed so the scorer's shape does not change when their data arrives; a factor with no data contributes nothing and is not guessed.

**Weights as built** (`confidence/score.ts`, about the best-matching product):

| Factor | Points |
|---|---|
| Identity: exact part number or model, or the product open on the page | 0.40 (probable 0.28, possible 0.20, words only 0.15) |
| Usable evidence: at least one real price (not 0.00) or available stock | 0.25 (suppliers answered but nothing usable: 0.10) |
| Observations confirmed by a person (always true for observations) | 0.10 |
| Freshness of the newest observation | fresh 0.20, recent 0.14, aging 0.07, stale 0.02 |
| At least one supplier stated available stock | 0.05 |
| Several products match and none exactly | minus 0.10 |
| Temporary (unverified) product | minus 0.05 |

Warnings are produced by the same function: words-only match, several matches, temporary product, no available stock, stock that is incoming / on request / out of stock / unknown, a 0.00 price, price without stock, VAT not stated, evidence one to two weeks old or older, mixed currencies, prices hidden for the role.

## Levels

| Level | Range |
|---|---|
| HIGH | 0.85 to 1.00 |
| MEDIUM | 0.60 to 0.84 |
| LOW | 0.00 to 0.59 |

## Display

Always both a number and the reasons, never a bare percentage.

```
Confidence: 91% High
- Exact part number found
- Supplier stock confirmed today
- Price from a supplier message
- Product specifications fully matched
```

```
Confidence: 58% Medium
Warnings:
- Only a generic product name was given
- No part number available
- The candidate is a technical equivalent
- Supplier stock is unconfirmed
```

```
Confidence: 22% Low
Action required:
- Confirm the exact model
- Confirm the required quantity
- Request current supplier stock
```

## Rules

- Warnings are **never** hidden because the score is high. A high score with a stale-stock warning shows both.
- The score never comes from the model. The model may word the reasons; the number and the factor list come from the scorer.
- A low score does not hide the answer. It shows what to confirm first.
- Calibration (comparing predicted confidence against what turned out to be right) needs feedback history and belongs to a later stage.
