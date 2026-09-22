import type { UserRole } from "../../generated/prisma/enums";
import type { ServiceContext } from "../database/tx";
import type { Actor } from "./actor";
import { ForbiddenError } from "../errors";

/**
 * What a person may see or do, by capability rather than by role, so that more roles later change only this map. Pure, no Next.js.
 * The AI layer checks these in its tools and context builder, so a field the actor may not see never reaches a prompt
 * (docs/ai-intelligence/security.md). With two roles (ADR 0006) both hold every capability except managing AI settings.
 */
export type Capability =
  | "product.read"
  | "supplier.read"
  /** Supplier prices (cost), and later margins. */
  | "supplier.cost.read"
  | "customer.read"
  | "ai.use"
  | "ai.settings.manage";

const EVERYDAY: readonly Capability[] = ["product.read", "supplier.read", "supplier.cost.read", "customer.read", "ai.use"];

export const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  ADMIN: [...EVERYDAY, "ai.settings.manage"],
  STAFF: EVERYDAY,
};

export function hasCapability(actor: Pick<Actor, "role">, capability: Capability): boolean {
  return ROLE_CAPABILITIES[actor.role].includes(capability);
}

export function assertCapability(ctx: ServiceContext, capability: Capability, message?: string): void {
  if (!hasCapability(ctx.actor, capability)) throw new ForbiddenError(message);
}
