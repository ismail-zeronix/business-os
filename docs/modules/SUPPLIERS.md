# Module: Suppliers

**Status:** Active (current milestone). Entities and columns: `prisma/schema.prisma`. Rationale: `docs/architecture/DATA_MODEL.md`.

A supplier is **procurement capability**, not a CRM company record. The system shows evidence and procurement characteristics separately; there is **no generic supplier score**.

## Owns
`Supplier`, `SupplierContact`, `SupplierBrand`, `SupplierCategory`, `SupplierContactBrand`, `SupplierContactCategory`.
Brands and categories themselves belong to the `products` module.

## Rules
- Only the name is required. Every other field may stay unknown (NULL); do not force users to invent data.
- `normalized_name` is unique across all statuses. Duplicate names produce a clear conflict message ("distinguish branches, e.g. 'ABC Computers - Sharjah'").
- Status is ACTIVE / INACTIVE / ARCHIVED. Suppliers and contacts are never hard-deleted.
- A supplier has any number of contacts; a contact can carry its own brands and categories. Brands/categories are relational (never comma-separated text).
- Procurement profile (payment terms, credit terms, warranty notes, delivery notes) is free text now. Numeric credit limit/period, delivery areas, lead time and term history are deferred (BACKLOG).
- Validate: name non-empty; email and website well-formed when supplied; phone/WhatsApp free-form but trimmed.
- "Last evidence" = the latest `EvidenceSource.observed_at` over the supplier's broadcasts (one grouped query per page, no N+1).

## Service functions (`modules/suppliers/service.ts`, `queries.ts`)
`createSupplier`, `updateSupplier`, `setSupplierStatus`, `setSupplierBrands`, `setSupplierCategories`, `addContact`, `updateContact`, `archiveContact`, `setContactBrands`, `setContactCategories`;
queries: `listSuppliers({q, status, type, brandId, categoryId, page})`, `getSupplierDetail`, `listContacts`, `getLastEvidenceBySupplier(ids)`, `listSupplierPricesAndStock(supplierId)`, `listSupplierActivity(supplierId)`.

## Audit actions
`supplier.created|updated|status_changed|brands_changed|categories_changed`, `supplier_contact.created|updated|archived` (scope = the supplier).

## UI
Suppliers list, supplier detail with tabs (Overview, Contacts, Broadcasts, Prices / Stock, Activity): see `docs/design/SCREENS.md`.

## Not in scope now
Supplier scoring or reliability metrics, supplier search across broadcast content/stock/credit ("Lenovo Dubai stockist 30 days credit"), RFQ history, account owner, supplier portal, documents. See `docs/ideas/BACKLOG.md`.
