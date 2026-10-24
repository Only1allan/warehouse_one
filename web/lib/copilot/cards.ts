export interface ProductRef {
  sku: string;
  name: string;
  unit: string;
  category: string;
}

export interface StockCard {
  kind: "stock";
  product: ProductRef;
  total: number;
  minStock: number;
  belowMinimum: boolean;
  locations: Array<{ locationId: string; qty: number; lastMovedAt: string }>;
}

export interface LocationCard {
  kind: "location";
  product: ProductRef;
  locations: Array<{
    locationId: string;
    label: string;
    qty: number;
  }>;
}

export interface CandidatesCard {
  kind: "candidates";
  query: string;
  products: Array<{ sku: string; name: string; category: string }>;
}

export interface NotFoundCard {
  kind: "not_found";
  query: string;
  what: "product" | "purchase_order";
}

export interface BelowMinimumCard {
  kind: "below_minimum";
  items: Array<{
    sku: string;
    name: string;
    unit: string;
    total: number;
    minStock: number;
  }>;
}

export interface ScheduleCard {
  kind: "schedule";
  date: string;
  label: string;
  orders: Array<{
    poNumber: string;
    supplier: string;
    status: "open" | "received";
    lines: Array<{ description: string; qty: number }>;
  }>;
}

export interface PoCard {
  kind: "po";
  poNumber: string;
  supplier: string;
  expectedDate: string;
  status: "open" | "received";
  lines: Array<{ sku: string; description: string; qty: number }>;
}

export interface SopCard {
  kind: "sop";
  sources: Array<{ document: string; section: string; excerpt: string }>;
}

export interface NoticeCard {
  kind: "notice";
  tone: "info" | "warning";
  text: string;
}

export type Card =
  | StockCard
  | LocationCard
  | CandidatesCard
  | NotFoundCard
  | BelowMinimumCard
  | ScheduleCard
  | PoCard
  | SopCard
  | NoticeCard;

export interface ConversationContext {
  lastSku?: string;
  lastLocationId?: string;
}
