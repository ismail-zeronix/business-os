import type { RequirementImportance, RequirementOperator } from "./types";

/**
 * The attributes a requirement can be about. Definitions live in code (like `email/scoring/config.ts`), not in database tables: they
 * change with the software that reads them. Laptop attributes come first; another category (server, switch) is more entries here,
 * not a new code path. `kind` says which value column carries the value: NUMBER -> value_num, TEXT -> value_text, LIST -> value_list.
 */

export type ValueKind = "NUMBER" | "TEXT" | "LIST";
export type AttributeOption = { value: string; label: string };

export type AttributeSpec = {
  key: string;
  label: string;
  kind: ValueKind;
  unit: string | null;
  /** Operators a person may choose for this attribute. */
  operators: readonly RequirementOperator[];
  defaultOperator: RequirementOperator;
  /** Importance when the customer states it plainly. Wording such as "preferably" lowers it to NICE. */
  defaultImportance: RequirementImportance;
  /** A closed vocabulary (TEXT and LIST only). CPU has none: it is parsed into a canonical string. */
  options?: readonly AttributeOption[];
};

const NUMBER_OPERATORS = ["GREATER_THAN_OR_EQUAL", "EQUALS", "LESS_THAN_OR_EQUAL", "BETWEEN"] as const;

export const ATTRIBUTES: readonly AttributeSpec[] = [
  { key: "cpu", label: "CPU", kind: "TEXT", unit: null, operators: ["EQUALS"], defaultOperator: "EQUALS", defaultImportance: "MUST" },
  { key: "ram_gb", label: "RAM", kind: "NUMBER", unit: "GB", operators: NUMBER_OPERATORS, defaultOperator: "GREATER_THAN_OR_EQUAL", defaultImportance: "MUST" },
  { key: "storage_gb", label: "Storage", kind: "NUMBER", unit: "GB", operators: NUMBER_OPERATORS, defaultOperator: "GREATER_THAN_OR_EQUAL", defaultImportance: "MUST" },
  {
    key: "storage_type",
    label: "Storage type",
    kind: "TEXT",
    unit: null,
    operators: ["EQUALS"],
    defaultOperator: "EQUALS",
    defaultImportance: "SHOULD",
    options: [
      { value: "ssd", label: "SSD" },
      { value: "hdd", label: "HDD" },
      { value: "emmc", label: "eMMC" },
    ],
  },
  { key: "screen_in", label: "Screen size", kind: "NUMBER", unit: "in", operators: NUMBER_OPERATORS, defaultOperator: "BETWEEN", defaultImportance: "MUST" },
  {
    key: "resolution",
    label: "Resolution",
    kind: "TEXT",
    unit: null,
    operators: ["EQUALS"],
    defaultOperator: "EQUALS",
    defaultImportance: "SHOULD",
    options: [
      { value: "fhd", label: "FHD (1920x1080)" },
      { value: "wuxga", label: "WUXGA (1920x1200)" },
      { value: "qhd", label: "QHD (2560x1440)" },
      { value: "wqxga", label: "WQXGA (2560x1600)" },
      { value: "2.8k", label: "2.8K (2880x1800)" },
      { value: "4k", label: "4K UHD (3840x2160)" },
    ],
  },
  {
    key: "os",
    label: "Operating system",
    kind: "TEXT",
    unit: null,
    operators: ["EQUALS"],
    defaultOperator: "EQUALS",
    defaultImportance: "MUST",
    options: [
      { value: "dos", label: "No OS / DOS" },
      { value: "windows-11-pro", label: "Windows 11 Pro" },
      { value: "windows-11-home", label: "Windows 11 Home" },
      { value: "windows-11", label: "Windows 11 (edition not stated)" },
      { value: "windows-10-pro", label: "Windows 10 Pro" },
      { value: "windows-10-home", label: "Windows 10 Home" },
      { value: "windows-10", label: "Windows 10 (edition not stated)" },
      { value: "ubuntu", label: "Ubuntu" },
      { value: "linux", label: "Linux" },
      { value: "chrome-os", label: "ChromeOS" },
      { value: "macos", label: "macOS" },
    ],
  },
  {
    key: "keyboard_lang",
    label: "Keyboard language",
    kind: "LIST",
    unit: null,
    operators: ["IN"],
    defaultOperator: "IN",
    defaultImportance: "MUST",
    options: [
      { value: "ar", label: "Arabic" },
      { value: "en", label: "English" },
    ],
  },
];

const BY_KEY = new Map(ATTRIBUTES.map((a) => [a.key, a]));

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key) as [string, ...string[]];

export function getAttribute(key: string): AttributeSpec | null {
  return BY_KEY.get(key) ?? null;
}

export function optionLabel(spec: AttributeSpec, value: string): string {
  return spec.options?.find((o) => o.value === value)?.label ?? value;
}
