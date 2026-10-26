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
  | "count_plan"
  | "dispatch"
  | "shipments_view"
  | "logistics_metrics"
  | "exceptions_view"
  | "equipment_report"
  | "health_view"
  | "handover"
  | "admin_reseed"
  | "readiness";

const ALL: Role[] = ROLES;

/**
 * Who can do what. Built from the personas in the source brief:
 * Operator: quick access to information, voice interaction, inventory verification.
 * Supervisor: operational visibility, exception reporting, inventory alerts.
 * Inventory Controller: accurate stock records, faster cycle counts, reconciliation support.
 * Logistics Manager: dispatch accuracy, shipment visibility, process compliance.
 */
export const CAPABILITIES: Record<Capability, Role[]> = {
  ask: ALL,
  readiness: ALL,
  equipment_report: ALL,
  receive: ["operator"],
  count: ["operator", "inventory_controller"],
  dispatch: ["operator", "logistics_manager"],
  stock_records: ["inventory_controller"],
  count_plan: ["inventory_controller"],
  stock_adjust: ["supervisor", "inventory_controller"],
  shipments_view: ["logistics_manager"],
  logistics_metrics: ["logistics_manager"],
  exceptions_view: ["supervisor"],
  health_view: ["supervisor"],
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

export interface NavGroup {
  /** The persona need from the source brief that this group serves. */
  need: string;
  items: NavItem[];
}

const item = (href: string, label: string, icon: string, capability: Capability): NavItem => ({
  href,
  label,
  icon,
  capability,
});

/** Each persona's sidebar, grouped by the needs listed for that persona in the brief. */
export const ROLE_NAV: Record<Role, NavGroup[]> = {
  operator: [
    { need: "My shift", items: [item("/home", "My shift", "home", "ask")] },
    {
      need: "Quick access to information",
      items: [item("/ask", "Ask the copilot", "ask", "ask"), item("/safety", "Safety", "shield", "ask")],
    },
    { need: "Voice interaction", items: [item("/voice", "Hands-free", "mic", "ask")] },
    {
      need: "Inventory verification",
      items: [
        item("/receive", "Receive delivery", "receive", "receive"),
        item("/count", "Count a shelf", "count", "count"),
        item("/dispatch", "Check a load", "send", "dispatch"),
      ],
    },
  ],
  supervisor: [
    {
      need: "Operational visibility",
      items: [item("/home", "Operations overview", "home", "ask"), item("/handover", "Shift handover", "note", "handover")],
    },
    { need: "Exception reporting", items: [item("/supervisor", "Exceptions", "alert", "exceptions_view")] },
    {
      need: "Inventory alerts",
      items: [item("/health", "Inventory alerts", "pulse", "health_view"), item("/approvals", "Stock approvals", "check", "stock_adjust")],
    },
    { need: "Ask", items: [item("/ask", "Ask the copilot", "ask", "ask")] },
  ],
  inventory_controller: [
    { need: "Overview", items: [item("/home", "Accuracy overview", "home", "ask")] },
    { need: "Accurate stock records", items: [item("/stock", "Stock records", "shelf", "stock_records")] },
    {
      need: "Faster cycle counts",
      items: [item("/count-plan", "Count plan", "note", "count_plan"), item("/count", "Cycle count", "count", "count")],
    },
    { need: "Reconciliation support", items: [item("/reconciliation", "Reconciliation", "check", "stock_adjust")] },
    { need: "Ask", items: [item("/ask", "Ask the copilot", "ask", "ask")] },
  ],
  logistics_manager: [
    { need: "Overview", items: [item("/home", "Logistics overview", "home", "ask")] },
    {
      need: "Dispatch accuracy",
      items: [item("/accuracy", "Dispatch accuracy", "pulse", "logistics_metrics"), item("/dispatch", "Check a load", "send", "dispatch")],
    },
    { need: "Shipment visibility", items: [item("/shipments", "Shipments", "truck", "shipments_view")] },
    {
      need: "Process compliance",
      items: [item("/compliance", "Compliance", "check", "logistics_metrics"), item("/handover", "Shift handover", "note", "handover")],
    },
    { need: "Ask", items: [item("/ask", "Ask the copilot", "ask", "ask")] },
  ],
};

export function navFor(role: Role): NavItem[] {
  return ROLE_NAV[role].flatMap((g) => g.items);
}

/** Every protected screen and the capability it needs. */
const PATH_CAPABILITIES: Array<[string, Capability]> = [
  ["/home", "ask"],
  ["/ask", "ask"],
  ["/safety", "ask"],
  ["/voice", "ask"],
  ["/readiness", "readiness"],
  ["/receive", "receive"],
  ["/count-plan", "count_plan"],
  ["/count", "count"],
  ["/dispatch", "dispatch"],
  ["/stock", "stock_records"],
  ["/reconciliation", "stock_adjust"],
  ["/approvals", "stock_adjust"],
  ["/shipments", "shipments_view"],
  ["/accuracy", "logistics_metrics"],
  ["/compliance", "logistics_metrics"],
  ["/health", "health_view"],
  ["/supervisor", "exceptions_view"],
  ["/handover", "handover"],
];

export function capabilityForPath(pathname: string): Capability | null {
  const match = PATH_CAPABILITIES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return match ? match[1] : null;
}
