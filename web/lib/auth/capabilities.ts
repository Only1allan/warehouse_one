export type Role = "operator" | "supervisor" | "inventory_controller" | "logistics_manager";

export const ROLES: Role[] = ["operator", "supervisor", "inventory_controller", "logistics_manager"];

export const ROLE_TITLES: Record<Role, string> = {
  operator: "Warehouse Operator",
  supervisor: "Warehouse Supervisor",
  inventory_controller: "Inventory Controller",
  logistics_manager: "Logistics Manager",
};

export type Capability =
  | "ask"
  | "receive"
  | "count"
  | "stock_adjust"
  | "stock_records"
  | "dispatch"
  | "shipments_view"
  | "exceptions_view"
  | "equipment_report"
  | "health_view"
  | "handover"
  | "admin_reseed"
  | "readiness";

const ALL: Role[] = ROLES;

export const CAPABILITIES: Record<Capability, Role[]> = {
  ask: ALL,
  readiness: ALL,
  equipment_report: ALL,
  receive: ["operator", "supervisor"],
  count: ["operator", "supervisor", "inventory_controller"],
  stock_adjust: ["supervisor", "inventory_controller"],
  stock_records: ["supervisor", "inventory_controller"],
  dispatch: ["operator", "supervisor", "logistics_manager"],
  shipments_view: ["supervisor", "logistics_manager"],
  exceptions_view: ["supervisor", "inventory_controller", "logistics_manager"],
  health_view: ["supervisor", "inventory_controller", "logistics_manager"],
  handover: ["supervisor", "logistics_manager"],
  admin_reseed: ["supervisor"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role);
}

export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  capability: Capability;
}

/** Destinations in navigation order. A role sees only the ones it holds the capability for. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: "home", capability: "ask" },
  { href: "/ask", label: "Ask", icon: "ask", capability: "ask" },
  { href: "/receive", label: "Receive", icon: "receive", capability: "receive" },
  { href: "/count", label: "Count", icon: "count", capability: "count" },
  { href: "/dispatch", label: "Dispatch", icon: "send", capability: "dispatch" },
  { href: "/stock", label: "Stock records", icon: "shelf", capability: "stock_records" },
  { href: "/shipments", label: "Shipments", icon: "truck", capability: "shipments_view" },
  { href: "/health", label: "Inventory health", icon: "pulse", capability: "health_view" },
  { href: "/supervisor", label: "Exceptions", icon: "supervisor", capability: "exceptions_view" },
  { href: "/handover", label: "Shift handover", icon: "note", capability: "handover" },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.capability));
}

export function capabilityForPath(pathname: string): Capability | null {
  const match = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return match ? match.capability : null;
}
