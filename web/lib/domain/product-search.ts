import type { Db } from "../db";

export interface ProductRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  reorderLevel: number;
  defaultLocationId: string;
  synonyms: string[];
}

export type ProductSearch =
  | { kind: "exact"; product: ProductRow }
  | { kind: "ambiguous"; products: ProductRow[] }
  | { kind: "none" };

const STOP = new Set(
  (
    "the a an any do does we you i have has how many much is are in on at of for to stock stocks " +
    "available there where can find located stored store what which shelf shelves aisle rack item " +
    "items sku code number product products please show me get our my this that it them left " +
    "remaining units unit pieces count whats"
  ).split(" "),
);

function stem(word: string): string {
  if (word.length > 4 && /(xes|ches|shes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

export function loadProducts(db: Db): ProductRow[] {
  const rows = db
    .prepare(
      "SELECT sku, name, category, unit, min_stock, reorder_level, default_location_id FROM products ORDER BY sku",
    )
    .all() as Array<{
    sku: string;
    name: string;
    category: string;
    unit: string;
    min_stock: number;
    reorder_level: number;
    default_location_id: string;
  }>;
  const synonyms = db.prepare("SELECT sku, synonym FROM product_synonyms").all() as Array<{
    sku: string;
    synonym: string;
  }>;
  const bySku = new Map<string, string[]>();
  for (const s of synonyms) bySku.set(s.sku, [...(bySku.get(s.sku) ?? []), s.synonym]);
  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    minStock: r.min_stock,
    reorderLevel: r.reorder_level,
    defaultLocationId: r.default_location_id,
    synonyms: bySku.get(r.sku) ?? [],
  }));
}

/**
 * Deterministic product matching: SKU first, then an exact name or synonym phrase,
 * then every word of the query appearing in the product. More than one match is ambiguous.
 */
export function findProducts(db: Db, query: string): ProductSearch {
  const products = loadProducts(db);

  const rawTokens = query
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase())
    .filter(Boolean);
  for (const token of rawTokens) {
    const hit = products.find((p) => p.sku.toLowerCase() === token);
    if (hit) return { kind: "exact", product: hit };
  }

  const q = tokenize(query);
  if (q.length === 0) return { kind: "none" };

  const phrases = (p: ProductRow) => [p.name, ...p.synonyms].map(tokenize);
  const exact = products.filter((p) => phrases(p).some((phrase) => sameSet(phrase, q)));
  if (exact.length === 1) return { kind: "exact", product: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", products: exact.slice(0, 8) };

  const covering = products.filter((p) => {
    const union = new Set(phrases(p).flat());
    return q.every((token) => union.has(token));
  });
  if (covering.length === 1) return { kind: "exact", product: covering[0] };
  if (covering.length > 1) return { kind: "ambiguous", products: covering.slice(0, 8) };
  return { kind: "none" };
}

const PRONOUNS = new Set(["it", "them", "that", "this", "one", "those", "these", "there", "same"]);

export function isFollowUpReference(query: string): boolean {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => PRONOUNS.has(w) || STOP.has(w));
}
