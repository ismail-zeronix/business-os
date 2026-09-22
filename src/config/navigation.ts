import { Building2, FileText, Inbox, LayoutDashboard, Package, RadioTower, ScrollText, Search, Settings, Users, type LucideIcon } from "lucide-react";
import { SETTINGS_NAVIGATION } from "./settings-navigation";

/** `adminOnly`: shown only to admins (the screen behind it also refuses everyone else). */
export type NavItem = { label: string; href: string; icon: LucideIcon; adminOnly?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * Primary navigation (docs/design/SCREENS.md). Future modules (RFQs, Agents) are intentionally ABSENT, not
 * disabled: no fake screens. Add an item here only when its screen exists and works. The sidebar and the breadcrumbs both read this.
 */
export const NAVIGATION: NavGroup[] = [
  { items: [{ label: "Overview", href: "/", icon: LayoutDashboard }] },
  {
    label: "Enquiries",
    items: [
      { label: "Enquiries", href: "/enquiries", icon: Inbox },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Quotations", href: "/quotations", icon: FileText },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Search", href: "/search", icon: Search },
      { label: "Suppliers", href: "/suppliers", icon: Building2 },
      { label: "Broadcasts", href: "/broadcasts", icon: RadioTower },
      { label: "Products", href: "/products", icon: Package },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Audit", href: "/audit", icon: ScrollText },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** One step of a breadcrumb trail. No `href` = not a link (the current page, or a group heading). */
export type Crumb = { label: string; href?: string };

const FLAT = NAVIGATION.flatMap((group) => group.items.map((item) => ({ item, group: group.label })));

/** The nav item that owns `pathname` (the longest matching href), with its group heading. */
function owner(pathname: string) {
  return FLAT.filter(({ item }) => isNavActive(pathname, item.href)).sort((a, b) => b.item.href.length - a.item.href.length)[0] ?? null;
}

/**
 * The breadcrumb trail for the top navbar: `Group > Section > Record`. The route alone gives `Group > Section` (and the Settings page
 * name), so something sensible shows immediately, even while a page is still loading. A page that knows its record (a supplier's name)
 * supplies the trail after the group, and that replaces the route's guess. Every ancestor links; the last step is the current page.
 */
export function crumbsFor(pathname: string, provided: Crumb[] | null): Crumb[] {
  const match = owner(pathname);
  // The group heading is context ("Procurement"); it is skipped when it only repeats the section ("Enquiries > Enquiries").
  const trail: Crumb[] = match?.group && match.group !== match.item.label ? [{ label: match.group }] : [];

  if (provided && provided.length > 0) return [...trail, ...provided];
  if (!match) return trail;

  const atSection = pathname === match.item.href;
  trail.push({ label: match.item.label, href: atSection ? undefined : match.item.href });
  if (match.item.href === "/settings") {
    // Settings sub-pages name themselves: Admin > Settings > Brands.
    const page = SETTINGS_NAVIGATION.flatMap((g) => g.items).find((i) => isNavActive(pathname, i.href));
    if (page) trail.push({ label: page.label });
  }
  return trail;
}
