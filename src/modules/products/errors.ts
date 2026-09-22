import { ConflictError } from "../../core/errors";

/**
 * A product with the same manufacturer part number already exists. Carries the existing product so the UI (notably broadcast review)
 * can offer "use the existing product" instead of leaving the user at a dead end.
 */
export class DuplicateProductError extends ConflictError {
  readonly existing: { id: string; name: string };

  constructor(existing: { id: string; name: string }, partNumber: string) {
    super(`A product with part number "${partNumber}" already exists: ${existing.name}. Use that product, or check the part number.`, {
      partNumber: "Already in use",
      // Lets a review screen offer "use the existing product" in one click instead of leaving the user at a dead end.
      _existingProductId: existing.id,
    });
    this.existing = existing;
  }
}
