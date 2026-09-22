# Product Name & Specs Display Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show full product specs (CPU, RAM, SSD, etc.) in Product name and description fields; display them without truncation as multi-line cells in the products table; add a supplier column with proper layout.

**Architecture:** Concatenate the parser's `specText` into `Product.name` and populate `Product.description` with full specs at product-creation time (both auto-create and manual drawer paths). In the products table, render name and specs as a multi-line cell per product row; add supplier column.

**Tech Stack:** Next.js, Prisma ORM, Tailwind CSS, React

**Spec:** Inline in the root issue and agent investigation report

---

## Global Constraints

- Product.name and Product.description must store full text (no database-level length limits)
- Products table must render full product name and specs across multiple lines in a single cell, no truncation
- Products table must have a Supplier column showing brand/manufacturer
- All changes must preserve existing audit/evidence trail (no deletion of broadcast data)

---

## Review Focus

1. **Spec text concatenation correctness:** Full specs (CPU, RAM, SSD, connectivity, OS, warranty) are included in Product.name and description, not partially or out of order.
2. **Product creation paths covered:** Both auto-create-on-confirm flow and manual "Create product" drawer include full specs in the prefilled name.
3. **Table cell display without clipping:** Products table renders full product name and specs in a multi-line cell without Tailwind `truncate`, `text-ellipsis`, or CSS clipping.
4. **Supplier column rendering:** Supplier name appears in products table alongside product name/specs; column width is stable and does not compress other columns.
5. **Search still works:** Search index includes description field; old products without description do not crash search.

---

## File Structure

**Service layer:**
- `src/modules/broadcasts/service.ts` — Update `productNameFromItem()` to concatenate specs; update `autoCreateProduct()` to pass `description` to Prisma.

**UI components:**
- `src/modules/broadcasts/components/item-row.tsx` — Update manual create drawer to include specText in name prefill.
- `src/modules/products/components/products-table.tsx` — Add supplier column; display name and specs in multi-line cell; remove truncate styling.

**Query layer:**
- `src/modules/products/queries.ts` — Add `description` field to search tokenization.

---

## Tasks

### Task 1: Update product name/description logic in broadcasts service

**Files:**
- Modify: `src/modules/broadcasts/service.ts:30-70`

**Interfaces:**
- Consumes: `BroadcastItem` with `description`, `specText`, `brandText`, `modelText`, `partNumber`
- Produces: `Product` with `name` (full description + specs) and `description` (specs only)

**Steps:**

- [ ] **Step 1: Read current `productNameFromItem()` and `autoCreateProduct()` logic**

Open `src/modules/broadcasts/service.ts` and read lines 30–70 to understand the current name-building and product-creation flow.

- [ ] **Step 2: Update `productNameFromItem()` to concatenate specText**

Replace the function (lines 30–38) to build the full name:

```typescript
function productNameFromItem(fields: {
  description: string | null;
  specText: string | null;
  brandText: string | null;
  modelText: string | null;
}): string {
  const parts = [];
  if (fields.description) parts.push(fields.description.trim());
  if (fields.specText) parts.push(fields.specText.trim());
  const name = parts.join(" ");
  return name.trim().slice(0, PRODUCT_NAME_MAX);
}
```

- [ ] **Step 3: Update `autoCreateProduct()` to pass description**

In `autoCreateProduct()` (lines 53–64), change the product creation call to include `description` with the specText:

```typescript
return await createProduct(
  c,
  productCreateSchema.parse({
    name,
    description: fields.specText?.trim() || null, // Add this line
    brandId: brand?.id ?? null,
    model: fields.modelText,
    partNumber: fields.partNumber,
  }),
  { isTemporary: true }
);
```

- [ ] **Step 4: Verify Prisma schema allows description on Product**

Open `prisma/schema.prisma` and confirm `Product.description` exists and is type `String?` (nullable). If missing, add:
```prisma
description String?
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/broadcasts/service.ts prisma/schema.prisma
git commit -m "feat: concatenate full specs into product name and description

- productNameFromItem now concatenates description + specText
- autoCreateProduct passes specText to Product.description
- Preserves full supplier broadcast data in product record

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Update manual create drawer to include specText

**Files:**
- Modify: `src/modules/broadcasts/components/item-row.tsx:40–85`

**Interfaces:**
- Consumes: `BroadcastItem` with `description`, `specText`
- Produces: Drawer form prefilled with full product name (description + specText)

**Steps:**

- [ ] **Step 1: Read current drawer logic**

Open `src/modules/broadcasts/components/item-row.tsx` and read lines 40–85 (the manual create drawer section).

- [ ] **Step 2: Update wording/prefill to include specText**

Replace line 44:
```typescript
const wording = item.description ?? [item.brandText, item.modelText].filter(Boolean).join(" ");
```

With:
```typescript
const specPart = item.specText ? ` ${item.specText.trim()}` : "";
const wording = `${item.description || [item.brandText, item.modelText].filter(Boolean).join(" ")}${specPart}`.trim();
```

- [ ] **Step 3: Verify drawer passes both name and description**

Check the `createDefaults` object (line 82). Ensure it passes both `name` and `description`:
```typescript
createDefaults={{
  name: wording,
  description: item.specText?.trim() || null, // Add this line
  // ... other fields
}}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/broadcasts/components/item-row.tsx
git commit -m "feat: include full specs in manual product create drawer

- Manual create drawer now prefills product name with description + specText
- Also passes specText as description field to the created product

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Add supplier column and multi-line name/specs display to products table

**Files:**
- Modify: `src/modules/products/components/products-table.tsx`

**Interfaces:**
- Consumes: `Product` with `name` (full specs included), `description`, `brand?.name`, `model`, `partNumber`
- Produces: Table with multi-line Product (name + specs) cell, Supplier column, Model, Part Number columns

**Steps:**

- [ ] **Step 1: Read current products table**

Open `src/modules/products/components/products-table.tsx` and understand the current column structure and styling.

- [ ] **Step 2: Update column definitions to display name and specs in a multi-line cell**

Replace the columns array (around line 10–30) to include a multi-line Product cell and supplier column:

```typescript
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <div className="block py-2">
        <div className="font-medium text-sm text-gray-900 break-words">{row.original.name}</div>
        {row.original.description && (
          <div className="text-xs text-gray-500 break-words mt-1 whitespace-pre-wrap">
            {row.original.description}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "brand.name",
    header: "Supplier",
    cell: ({ row }) => row.original.brand?.name || "—",
  },
  {
    accessorKey: "model",
    header: "Model",
    cell: ({ row }) => row.original.model || "—",
  },
  {
    accessorKey: "partNumber",
    header: "Part Number",
    cell: ({ row }) => row.original.partNumber || "—",
  },
];
```

- [ ] **Step 3: Remove truncate styling from the table**

Search the file for any `truncate`, `text-ellipsis`, `overflow-hidden`, or `line-clamp-*` classes on the name/product cell and remove them. The multi-line cell in Step 2 should be the only name rendering.

- [ ] **Step 4: Ensure table rows have adequate height**

Add `align-top` or similar vertical alignment to table rows so multi-line cells render properly (e.g., on the `<tr>` or parent table wrapper):

```tsx
<Table className="table-auto">
  {/* columns and rows */}
</Table>
```

Verify rows expand to fit multi-line content without clipping.

- [ ] **Step 5: Commit**

```bash
git add src/modules/products/components/products-table.tsx
git commit -m "feat: display full product name and specs in table, add supplier column

- Product cell now displays name and specs as multi-line text
- Add Supplier column showing brand name
- Remove truncate styling; rows expand to fit multi-line content
- Model and Part Number columns remain for quick reference

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Update product search to include description field

**Files:**
- Modify: `src/modules/products/queries.ts:34–51`

**Interfaces:**
- Consumes: `Product` with `name`, `description`, `model`, `partNumber`, `brand`
- Produces: Search query that tokenizes and matches on description as well

**Steps:**

- [ ] **Step 1: Read tokenClause() function**

Open `src/modules/products/queries.ts` and read `tokenClause()` (lines 34–51) to understand how it builds search filters.

- [ ] **Step 2: Add description to search fields**

Update the `OR` array in `tokenClause()` to include `description`:

```typescript
function tokenClause(token: string) {
  return Prisma.sql`(
    product.name ILIKE ${`%${token}%`}
    OR product.description ILIKE ${`%${token}%`}
    OR product.model ILIKE ${`%${token}%`}
    OR product.partNumber ILIKE ${`%${token}%`}
    OR brand.name ILIKE ${`%${token}%`}
    OR category.name ILIKE ${`%${token}%`}
    OR product.manufacturerSku ILIKE ${`%${token}%`}
  )`;
}
```

- [ ] **Step 3: Test search with a product that has specs**

After implementation, open the product search and search for a spec keyword (e.g., "16GB DDR5" or "U7-265") from one of your test products. Verify it returns the product.

- [ ] **Step 4: Commit**

```bash
git add src/modules/products/queries.ts
git commit -m "feat: include product description in search

- Add description field to tokenClause search filter
- Users can now search for specs (CPU, RAM, SSD, etc.)
- Improves discoverability of products added from broadcasts

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Manual verification on products table

**Files:**
- None (manual testing only)

**Steps:**

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait for the server to start at `http://localhost:3000`.

- [ ] **Step 2: Navigate to products page**

Go to the Products page (`/products` or via sidebar).

- [ ] **Step 3: Verify products table displays correctly**

Check that:
- Product name column now displays full name + specs stacked (name on top, specs below)
- Specs are fully visible without truncation
- Supplier column appears with brand names
- Model and Part Number columns are visible
- Table rows expand vertically to fit multi-line content
- Table layout is stable (no text overlap or column collapse)

- [ ] **Step 4: Verify multi-line display for test products**

For one of your test Lenovo products (e.g., `12YM000LGR`), confirm the table displays:
```
Lenovo Desktop M70t G6, Tower, U7-265, 16GB DDR5, 512GB SSD M.2 2280, ...
[specs line]
```

- [ ] **Step 5: Test search for specs**

In the search box, search for a spec keyword (e.g., "16GB DDR5", "U7-265", "MOUSE").

- [ ] **Step 6: Verify search results**

Confirm that:
- The search returns the product that contains that spec keyword
- The product name + specs in the results are fully visible (no truncation)

- [ ] **Step 7: No commit needed for this task**

Manual testing is complete; all code changes committed in earlier tasks.

---

## Summary

After all 5 tasks:

✅ Broadcast parser's `specText` is concatenated into `Product.name` and stored in `Product.description`  
✅ Both auto-create and manual create paths include full specs  
✅ Products table displays name and specs as multi-line cell (no truncation)  
✅ Supplier column added to products table  
✅ Search can now find products by spec keywords (CPU, RAM, SSD, etc.)  

---

Plan updated and saved. Ready to implement?