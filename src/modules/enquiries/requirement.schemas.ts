import { z } from "zod";
import { optionalText, requiredEnum, stringArray } from "../../core/validation/fields";
import { ATTRIBUTE_KEYS } from "../specs/registry";
import { REQUIREMENT_IMPORTANCES, REQUIREMENT_OPERATORS } from "../specs/types";

/**
 * What a person types to add or change a specification requirement. The form is generic (one value box, an upper value for "between",
 * ticked options for lists); the service turns it into the typed columns for the attribute (requirement.service.ts, `buildRequirementValue`).
 */
const valueFields = {
  operator: requiredEnum(REQUIREMENT_OPERATORS, "comparison"),
  importance: requiredEnum(REQUIREMENT_IMPORTANCES, "importance"),
  value: optionalText(100),
  valueMax: optionalText(30),
  valueList: stringArray(),
};

export const requirementAddSchema = z.object({ itemId: z.uuid(), attributeKey: z.enum(ATTRIBUTE_KEYS, { error: "Choose a specification" }), ...valueFields });
export const requirementReplaceSchema = z.object({ id: z.uuid(), ...valueFields });
export const requirementRetractSchema = z.object({ id: z.uuid(), reason: optionalText(300) });
export const requirementReextractSchema = z.object({ itemId: z.uuid() });

export type RequirementAddInput = z.output<typeof requirementAddSchema>;
export type RequirementReplaceInput = z.output<typeof requirementReplaceSchema>;
export type RequirementRetractInput = z.output<typeof requirementRetractSchema>;
export type RequirementReextractInput = z.output<typeof requirementReextractSchema>;
