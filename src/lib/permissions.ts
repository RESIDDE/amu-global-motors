// ─── Role & Page Definitions ────────────────────────────────────────────────

export type AppRole = "super_admin" | "admin" | "sales" | "mechanic";

export type PageKey =
  | "dashboard"
  | "vehicles"
  | "customers"
  | "sales"
  | "invoices"
  | "inquiries"
  | "inspections"
  | "repairs"
  | "authority-to-sell";

export const ALL_PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: "dashboard",        label: "Dashboard",         path: "/dashboard" },
  { key: "vehicles",         label: "Vehicles",          path: "/vehicles" },
  { key: "customers",        label: "Customers",         path: "/customers" },
  { key: "sales",            label: "Sales",             path: "/sales" },
  { key: "invoices",         label: "Invoices",          path: "/invoices" },
  { key: "inquiries",        label: "Inquiries",         path: "/inquiries" },
  { key: "inspections",      label: "Inspections",       path: "/inspections" },
  { key: "repairs",          label: "Repairs",           path: "/repairs" },
  { key: "authority-to-sell", label: "Auth. Form",       path: "/authority-to-sell" },
];

// super_admin can always see everything — not configurable
export const SUPER_ADMIN_PAGES: PageKey[] = ALL_PAGES.map((p) => p.key);

export const DEFAULT_PERMISSIONS: PermissionsMap = {
  admin:    { view: ALL_PAGES.map((p) => p.key), edit: ALL_PAGES.map((p) => p.key) },
  sales:    { view: ["dashboard", "vehicles", "customers", "sales", "invoices", "inquiries"], edit: ["vehicles", "customers", "sales", "invoices", "inquiries"] },
  mechanic: { view: ["dashboard", "vehicles", "repairs", "inspections"], edit: ["vehicles", "repairs", "inspections"] },
};

// ─── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = "beetee_permissions_v1";

type PermissionsMap = Record<Exclude<AppRole, "super_admin">, { view: PageKey[], edit: PageKey[] }>;

export function getPermissions(): PermissionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate from old array structure to { view, edit } structure
      if (parsed.admin && Array.isArray(parsed.admin)) {
        const migrated = {} as PermissionsMap;
        for (const role in parsed) {
          migrated[role as Exclude<AppRole, "super_admin">] = {
            view: parsed[role],
            edit: parsed[role],
          };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return parsed as PermissionsMap;
    }
  } catch {}
  return { ...DEFAULT_PERMISSIONS };
}

export function savePermissions(map: PermissionsMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function resetPermissions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns true if the given role is allowed to access the given page.
 * super_admin always returns true.
 */
export function canAccess(role: AppRole | null, page: PageKey): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  const perms = getPermissions();
  return (perms[role as Exclude<AppRole, "super_admin">]?.view ?? []).includes(page);
}

/**
 * Returns true if the given role is allowed to edit/delete existing records on the given page.
 * super_admin always returns true.
 */
export function canEdit(role: AppRole | null, page: PageKey): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  const perms = getPermissions();
  return (perms[role as Exclude<AppRole, "super_admin">]?.edit ?? []).includes(page);
}

/**
 * Returns the list of pages accessible to this role.
 */
export function getAccessiblePages(role: AppRole | null): PageKey[] {
  if (!role) return [];
  if (role === "super_admin") return SUPER_ADMIN_PAGES;
  const perms = getPermissions();
  return perms[role as Exclude<AppRole, "super_admin">]?.view ?? [];
}

