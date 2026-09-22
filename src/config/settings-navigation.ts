import { Bot, Building2, Mail, Tags, Users, type LucideIcon } from "lucide-react";

export type SettingsItem = { label: string; href: string; icon: LucideIcon };
export type SettingsGroup = { label: string; items: SettingsItem[] };

/**
 * Every setting in the application lives here: add an item when its page exists and works (no disabled or placeholder entries, same
 * rule as the main sidebar). Read by the Settings sidebar and by the top navbar's breadcrumbs.
 */
export const SETTINGS_NAVIGATION: SettingsGroup[] = [
  {
    label: "Master data",
    items: [
      { label: "Brands", href: "/settings/brands", icon: Building2 },
      { label: "Categories", href: "/settings/categories", icon: Tags },
    ],
  },
  {
    label: "Integrations",
    items: [
      { label: "Email accounts", href: "/settings/email", icon: Mail },
      { label: "AI", href: "/settings/ai", icon: Bot },
    ],
  },
  {
    label: "Access",
    items: [{ label: "Users", href: "/settings/users", icon: Users }],
  },
];
