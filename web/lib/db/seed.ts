import type { Db } from "./index";
import { inTransaction, resetSchema } from "./index";
import { recordEvent } from "../events";
import { DEMO_ACCOUNTS } from "../auth/demo-accounts";
import { hashPassword } from "../auth/password";
import { addDays, dayKey, SHIFTS } from "../time";

interface SeedProduct {
  sku: string;
  name: string;
  category: string;
  unit: string;
  min: number;
  reorder: number;
  locs: Array<[string, number]>;
  synonyms: string[];
  lastMoveDays: number;
}

const P = (
  sku: string,
  name: string,
  category: string,
  unit: string,
  min: number,
  reorder: number,
  locs: Array<[string, number]>,
  synonyms: string[],
  lastMoveDays: number,
): SeedProduct => ({
  sku,
  name,
  category,
  unit,
  min,
  reorder,
  locs,
  synonyms,
  lastMoveDays,
});

const PRODUCTS: SeedProduct[] = [
  P("001254", "Portable Generator 5kW", "Power Equipment", "unit", 10, 20, [["B-4-2", 43]], ["generator", "generators", "genset", "power generator"], 3),
  P("001310", "Extension Cable Reel 50m", "Power Equipment", "unit", 15, 30, [["B-4-1", 40], ["B-4-2", 24]], ["extension cable", "cable reel"], 4),
  P("001420", "LED Work Light", "Power Equipment", "unit", 10, 25, [["B-3-2", 38]], ["work light", "floodlight"], 4),
  P("A340", "Pallet Jack Wheel Set", "Spare Parts", "set", 5, 10, [["A-1-1", 12]], ["wheel", "wheels", "pallet jack wheel"], 6),
  P("A341", "Forklift Fork Pad", "Spare Parts", "unit", 4, 8, [["A-1-2", 9]], ["fork pad", "fork pads"], 12),
  P("200310", "Hydraulic Hose Kit", "Spare Parts", "kit", 10, 20, [["A-2-1", 35]], ["hose", "hydraulic hose", "hose kit"], 5),
  P("700020", "Spare Fan Belt", "Spare Parts", "unit", 5, 10, [["A-2-2", 22]], ["fan belt", "belt"], 45),
  P("700010", "Obsolete Printer Cartridge", "Office", "unit", 0, 5, [["D-4-2", 75]], ["printer cartridge", "cartridge", "toner"], 200),
  P("200415", "Bearing 6205", "Spare Parts", "unit", 20, 40, [["A-3-1", 180]], ["bearing", "bearings"], 8),
  P("100201", "Corrugated Carton 40x30x30", "Packaging", "carton", 200, 400, [["C-1-1", 360], ["C-1-2", 100]], ["carton", "cartons", "box", "boxes", "corrugated box"], 1),
  P("100202", "Corrugated Carton 60x40x40", "Packaging", "carton", 100, 200, [["C-1-2", 240]], ["large carton", "big box", "carton", "cartons"], 2),
  P("100305", "Stretch Wrap Roll", "Packaging", "roll", 100, 200, [["C-2-1", 700]], ["stretch wrap", "shrink wrap", "wrap roll"], 9),
  P("100410", "Packing Tape 48mm", "Packaging", "roll", 100, 240, [["C-2-2", 90]], ["tape", "packing tape"], 1),
  P("100520", "Bubble Wrap Roll", "Packaging", "roll", 20, 50, [["C-3-1", 75]], ["bubble wrap"], 7),
  P("100630", "Wooden Pallet 1200x1000", "Packaging", "pallet", 50, 150, [["C-4-1", 320]], ["wooden pallet", "wooden pallets"], 2),
  P("300118", "Hi-Vis Safety Vest", "Safety", "unit", 25, 60, [["D-1-1", 18]], ["vest", "hi-vis vest", "safety vest", "high visibility vest"], 2),
  P("300125", "Safety Helmet", "Safety", "unit", 20, 40, [["D-1-2", 55]], ["helmet", "hard hat"], 5),
  P("300210", "Nitrile Gloves L (box of 100)", "Safety", "box", 20, 40, [["D-2-1", 48]], ["gloves", "nitrile gloves"], 2),
  P("300211", "Leather Work Gloves L", "Safety", "pair", 20, 40, [["D-2-2", 36]], ["gloves", "leather gloves", "work gloves"], 4),
  P("300305", "Safety Boots Size 42", "Safety", "pair", 10, 20, [["D-3-2", 14]], ["boots", "safety boots"], 10),
  P("300410", "Ear Defenders", "Safety", "unit", 10, 20, [["D-4-1", 26]], ["ear defenders", "ear muffs", "ear protection"], 15),
  P("300520", "First Aid Kit", "Safety", "kit", 5, 10, [["A-4-1", 11]], ["first aid kit", "first aid"], 20),
  P("400210", "Industrial Cleaner 20L", "Chemicals", "drum", 6, 12, [["B-1-1", 21]], ["cleaner", "industrial cleaner"], 6),
  P("400215", "Degreaser 5L", "Chemicals", "can", 10, 20, [["B-1-2", 33]], ["degreaser"], 7),
  P("400320", "Lubricant Oil 20L", "Chemicals", "drum", 5, 10, [["B-2-1", 16]], ["oil", "lubricant", "engine oil", "lubricating oil"], 3),
  P("400430", "Spill Absorbent Pads (pack of 50)", "Chemicals", "pack", 10, 20, [["B-2-2", 27]], ["absorbent pads", "spill pads"], 12),
  P("500110", "Label Roll 100x150", "Consumables", "roll", 30, 60, [["C-3-2", 120]], ["label", "labels", "shipping labels"], 1),
  P("500210", "Thermal Printer Ribbon", "Consumables", "unit", 8, 16, [["C-4-2", 20]], ["ribbon", "printer ribbon"], 13),
  P("500320", "Cable Ties 300mm (bag of 100)", "Consumables", "bag", 30, 60, [["C-4-2", 95]], ["cable ties", "zip ties"], 9),
  P("500430", "Pallet Strapping Band", "Consumables", "roll", 15, 30, [["B-3-1", 28]], ["strapping", "strap", "strapping band"], 11),
  P("P-324", "Decorative Table Lamp", "Retail Goods", "unit", 5, 15, [["D-3-1", 62]], ["lamp", "table lamp", "decorative lamp"], 120),
  P("600100", "Roofing Sheets (pallet of 100)", "Building Materials", "pallet", 30, 60, [["A-4-2", 120]], ["roofing sheets", "roofing", "iron sheets"], 2),
  P("600110", "Cement 50kg (pallet of 40 bags)", "Building Materials", "pallet", 20, 40, [["A-3-2", 85]], ["cement"], 1),
  P("600120", "Ceramic Floor Tiles (pallet)", "Building Materials", "pallet", 15, 30, [["D-2-1", 40]], ["tiles", "floor tiles", "ceramic tiles"], 14),
  P("600130", "Steel Reinforcement Bars (bundle)", "Building Materials", "bundle", 20, 40, [["D-2-2", 60]], ["rebar", "steel bars", "reinforcement bars"], 5),
  P("600140", "PVC Pipe 110mm (bundle)", "Building Materials", "bundle", 20, 40, [["C-3-1", 72]], ["pvc pipe", "pipes", "pipe"], 6),
  P("600150", "Paint 20L White", "Building Materials", "bucket", 15, 30, [["C-3-2", 44]], ["paint", "white paint"], 4),
  P("800100", "Water Pump 2in", "Power Equipment", "unit", 6, 12, [["B-3-2", 19]], ["pump", "water pump"], 8),
  P("800110", "Pressure Washer", "Power Equipment", "unit", 4, 8, [["B-3-1", 11]], ["pressure washer", "washer"], 14),
  P("800120", "Angle Grinder 115mm", "Power Equipment", "unit", 8, 16, [["B-3-2", 27]], ["grinder", "angle grinder"], 3),
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function at(now: Date, daysAgo: number, hour: number, minute = 0): Date {
  const d = addDays(now, -daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface Movement {
  delta: number;
  kind: "receipt" | "dispatch" | "adjustment" | "seed";
  at: Date;
}

function buildHistory(
  rand: () => number,
  now: Date,
  qty: number,
  lastMoveDays: number,
): Movement[] {
  const dead = lastMoveDays >= 90;
  const oldest = dead ? lastMoveDays + 60 : 90;
  const count = 4 + Math.floor(rand() * 5);
  const days: number[] = [];
  for (let i = 0; i < count - 2; i++) {
    const span = oldest - lastMoveDays;
    days.push(lastMoveDays + 1 + Math.floor(rand() * Math.max(1, span - 1)));
  }
  days.sort((a, b) => b - a);
  const timeline = [oldest, ...days, lastMoveDays];
  const opening = qty + Math.floor(rand() * (qty + 10)) + 5;
  const movements: Movement[] = [
    { delta: opening, kind: "seed", at: at(now, timeline[0], 7) },
  ];
  let running = opening;
  for (let i = 1; i < timeline.length - 1; i++) {
    const room = running;
    const sign = rand() < 0.55 ? -1 : 1;
    const size = 1 + Math.floor(rand() * Math.max(2, Math.floor(qty / 4)));
    const delta = sign < 0 ? -Math.min(size, Math.floor(room / 2)) : size;
    if (delta === 0) continue;
    running += delta;
    movements.push({
      delta,
      kind: delta > 0 ? "receipt" : "dispatch",
      at: at(now, timeline[i], 8 + Math.floor(rand() * 10)),
    });
  }
  const finalDelta = qty - running;
  const lastAt = at(now, lastMoveDays, 9 + Math.floor(rand() * 8));
  if (finalDelta !== 0) {
    movements.push({
      delta: finalDelta,
      kind: finalDelta > 0 ? "receipt" : "dispatch",
      at: lastAt,
    });
  } else {
    movements.push({ delta: 1, kind: "receipt", at: lastAt });
    movements.push({ delta: -1, kind: "dispatch", at: lastAt });
  }
  return movements;
}

export interface SeedSummary {
  products: number;
  locations: number;
  purchaseOrders: number;
  salesOrders: number;
  movements: number;
  events: number;
  exceptions: number;
}

export function seedDatabase(db: Db, now: Date): SeedSummary {
  resetSchema(db);
  const rand = mulberry32(20261024);

  return inTransaction(db, () => {
    const insOperator = db.prepare(
      "INSERT INTO operators (id, name, role, username, password_hash) VALUES (?, ?, ?, ?, ?)",
    );
    for (const a of DEMO_ACCOUNTS) {
      insOperator.run(a.id, a.name, a.role, a.username, hashPassword(a.password, `demo-salt-${a.username}`));
    }

    const insShift = db.prepare(
      "INSERT INTO shifts (id, name, start_hour, end_hour) VALUES (?, ?, ?, ?)",
    );
    for (const s of SHIFTS) insShift.run(s.id, s.name, s.startHour, s.endHour);

    const insLocation = db.prepare(
      "INSERT INTO locations (id, aisle, rack, shelf, zone) VALUES (?, ?, ?, ?, ?)",
    );
    let locationCount = 0;
    for (const aisle of ["A", "B", "C", "D"]) {
      for (let rack = 1; rack <= 4; rack++) {
        for (let shelf = 1; shelf <= 2; shelf++) {
          insLocation.run(
            `${aisle}-${rack}-${shelf}`,
            aisle,
            rack,
            shelf,
            `Zone ${aisle}`,
          );
          locationCount++;
        }
      }
    }
    insLocation.run("QUAR", "Q", 0, 0, "Quarantine");
    locationCount++;

    const insProduct = db.prepare(
      "INSERT INTO products (sku, name, category, unit, min_stock, reorder_level, default_location_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insSynonym = db.prepare(
      "INSERT OR IGNORE INTO product_synonyms (sku, synonym) VALUES (?, ?)",
    );
    const insStock = db.prepare(
      "INSERT INTO stock (sku, location_id, qty, last_moved_at) VALUES (?, ?, ?, ?)",
    );
    const insMovement = db.prepare(
      "INSERT INTO movements (sku, location_id, delta, kind, at) VALUES (?, ?, ?, ?, ?)",
    );
    let movementCount = 0;
    for (const p of PRODUCTS) {
      insProduct.run(p.sku, p.name, p.category, p.unit, p.min, p.reorder, p.locs[0][0]);
      for (const syn of p.synonyms) insSynonym.run(p.sku, syn.toLowerCase());
      for (const [loc, qty] of p.locs) {
        const history = buildHistory(rand, now, qty, p.lastMoveDays);
        for (const m of history) {
          insMovement.run(p.sku, loc, m.delta, m.kind, m.at.toISOString());
          movementCount++;
        }
        const last = history[history.length - 1].at;
        insStock.run(p.sku, loc, qty, last.toISOString());
      }
    }

    const insPo = db.prepare(
      "INSERT INTO purchase_orders (po_number, supplier, expected_date, status) VALUES (?, ?, ?, ?)",
    );
    const insPoLine = db.prepare(
      "INSERT INTO po_lines (po_number, sku, description, qty_ordered) VALUES (?, ?, ?, ?)",
    );
    const nameOf = (sku: string) => PRODUCTS.find((p) => p.sku === sku)!.name;
    const pos: Array<{
      po: string;
      supplier: string;
      offset: number;
      status: "open" | "received";
      lines: Array<[string, number]>;
    }> = [
      { po: "4470", supplier: "Kenya Packaging Ltd", offset: -1, status: "received", lines: [["100202", 100]] },
      { po: "4471", supplier: "Kenya Packaging Ltd", offset: 0, status: "open", lines: [["100201", 150], ["100305", 60], ["100410", 120]] },
      { po: "4472", supplier: "SafeWorks East Africa", offset: 0, status: "open", lines: [["300118", 80], ["300125", 40]] },
      { po: "4473", supplier: "Nairobi Industrial Supplies", offset: 1, status: "open", lines: [["001254", 10], ["800120", 20]] },
      { po: "4474", supplier: "ChemSupply Ltd", offset: 2, status: "open", lines: [["400210", 24], ["400215", 36]] },
      { po: "4475", supplier: "Coastal Building Supplies", offset: -3, status: "received", lines: [["600100", 40]] },
      { po: "4476", supplier: "PowerTech Ltd", offset: 4, status: "open", lines: [["001420", 30]] },
    ];
    for (const po of pos) {
      insPo.run(po.po, po.supplier, dayKey(addDays(now, po.offset)), po.status);
      for (const [sku, qty] of po.lines) insPoLine.run(po.po, sku, nameOf(sku), qty);
    }

    const insOrder = db.prepare(
      "INSERT INTO sales_orders (order_number, customer, destination, status) VALUES (?, ?, ?, ?)",
    );
    const insOrderLine = db.prepare(
      "INSERT INTO order_lines (order_number, sku, qty_ordered, qty_loaded) VALUES (?, ?, ?, ?)",
    );
    const orders: Array<{
      no: string;
      customer: string;
      destination: string;
      status: "open" | "dispatched";
      lines: Array<[string, number, number | null]>;
    }> = [
      { no: "5520", customer: "Machakos Retail", destination: "Machakos", status: "dispatched", lines: [["500210", 20, 18]] },
      { no: "5521", customer: "Mombasa Hardware Ltd", destination: "Mombasa", status: "open", lines: [["600100", 50, null]] },
      { no: "5522", customer: "Kisumu Builders", destination: "Kisumu", status: "open", lines: [["600110", 30, null], ["600140", 20, null]] },
      { no: "5523", customer: "Nakuru Power Co", destination: "Nakuru", status: "open", lines: [["001254", 5, null], ["001310", 10, null]] },
      { no: "5524", customer: "Eldoret Farm Supplies", destination: "Eldoret", status: "open", lines: [["400320", 4, null], ["800100", 6, null]] },
      { no: "5525", customer: "Thika Safety Mart", destination: "Thika", status: "open", lines: [["300118", 10, null], ["300125", 20, null]] },
      { no: "5526", customer: "Nairobi Retail Hub", destination: "Nairobi", status: "dispatched", lines: [["500110", 40, 40]] },
    ];
    for (const o of orders) {
      insOrder.run(o.no, o.customer, o.destination, o.status);
      for (const [sku, qty, loaded] of o.lines) insOrderLine.run(o.no, sku, qty, loaded);
    }

    const insReceipt = db.prepare(
      "INSERT INTO receipts (po_number, operator_id, shift_id, received_at, has_discrepancy) VALUES (?, ?, ?, ?, ?)",
    );
    const insReceiptLine = db.prepare(
      "INSERT INTO receipt_lines (receipt_id, sku, expected_qty, received_qty, status) VALUES (?, ?, ?, ?, ?)",
    );
    const insException = db.prepare(
      "INSERT INTO exceptions (kind, ref_id, summary, operator_id, shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    let exceptionCount = 0;
    let eventCount = 0;

    const r1At = at(now, 3, 9, 15);
    const r1 = Number(insReceipt.run("4475", "o-amina", "s-morning", r1At.toISOString(), 0).lastInsertRowid);
    insReceiptLine.run(r1, "600100", 40, 40, "exact");
    recordEvent(db, { type: "receipt_confirmed", operatorId: "o-amina", shiftId: "s-morning", at: r1At, payload: { receiptId: r1, poNumber: "4475", hasDiscrepancy: false, lines: 1 } });
    eventCount++;

    const r2At = at(now, 1, 15, 40);
    const r2 = Number(insReceipt.run("4470", "o-brian", "s-afternoon", r2At.toISOString(), 1).lastInsertRowid);
    insReceiptLine.run(r2, "100202", 100, 92, "short");
    recordEvent(db, { type: "receipt_confirmed", operatorId: "o-brian", shiftId: "s-afternoon", at: r2At, payload: { receiptId: r2, poNumber: "4470", hasDiscrepancy: true, lines: 1 } });
    insException.run("receiving", r2, "PO 4470: Corrugated Carton 60x40x40 expected 100, received 92 (missing 8)", "o-brian", "s-afternoon", r2At.toISOString());
    eventCount++;
    exceptionCount++;

    const insDispatch = db.prepare(
      "INSERT INTO dispatches (order_number, operator_id, shift_id, dispatched_at, has_shortfall) VALUES (?, ?, ?, ?, ?)",
    );
    const d1At = at(now, 1, 11, 5);
    const d1 = Number(insDispatch.run("5526", "o-chebet", "s-morning", d1At.toISOString(), 0).lastInsertRowid);
    recordEvent(db, { type: "dispatch_confirmed", operatorId: "o-chebet", shiftId: "s-morning", at: d1At, payload: { dispatchId: d1, orderNumber: "5526", hasShortfall: false } });
    const d2At = at(now, 1, 16, 20);
    const d2 = Number(insDispatch.run("5520", "o-brian", "s-afternoon", d2At.toISOString(), 1).lastInsertRowid);
    recordEvent(db, { type: "dispatch_confirmed", operatorId: "o-brian", shiftId: "s-afternoon", at: d2At, payload: { dispatchId: d2, orderNumber: "5520", hasShortfall: true } });
    insException.run("dispatch", d2, "Order 5520: Thermal Printer Ribbon ordered 20, loaded 18 (missing 2)", "o-brian", "s-afternoon", d2At.toISOString());
    eventCount += 2;
    exceptionCount++;

    const insCount = db.prepare(
      "INSERT INTO counts (sku, location_id, expected_qty, proposed_qty, confirmed_qty, variance, photo_path, operator_id, shift_id, counted_at, adjusted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    );
    const c1At = at(now, 1, 10, 30);
    const c1 = Number(insCount.run("200415", "A-3-1", 180, null, 176, -4, null, "o-chebet", "s-morning", c1At.toISOString()).lastInsertRowid);
    recordEvent(db, { type: "count_confirmed", operatorId: "o-chebet", shiftId: "s-morning", at: c1At, payload: { countId: c1, sku: "200415", locationId: "A-3-1", expected: 180, confirmed: 176, variance: -4 } });
    insException.run("count", c1, "Count A-3-1: Bearing 6205 expected 180, counted 176 (variance -4)", "o-chebet", "s-morning", c1At.toISOString());
    const c2At = at(now, 1, 10, 50);
    const c2 = Number(insCount.run("100520", "C-3-1", 75, null, 75, 0, null, "o-chebet", "s-morning", c2At.toISOString()).lastInsertRowid);
    recordEvent(db, { type: "count_confirmed", operatorId: "o-chebet", shiftId: "s-morning", at: c2At, payload: { countId: c2, sku: "100520", locationId: "C-3-1", expected: 75, confirmed: 75, variance: 0 } });
    eventCount += 2;
    exceptionCount++;

    const insIssue = db.prepare(
      "INSERT INTO equipment_issues (equipment, description, reported_at, operator_id, shift_id, status) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const e1At = at(now, 1, 13, 10);
    const e1 = Number(insIssue.run("Forklift F03", "Hydraulic lift is slow and needs maintenance", e1At.toISOString(), "o-amina", "s-morning", "open").lastInsertRowid);
    recordEvent(db, { type: "equipment_issue_reported", operatorId: "o-amina", shiftId: "s-morning", at: e1At, payload: { issueId: e1, equipment: "Forklift F03" } });
    insException.run("equipment", e1, "Forklift F03: Hydraulic lift is slow and needs maintenance", "o-amina", "s-morning", e1At.toISOString());
    const e2At = at(now, 2, 8, 0);
    const e2 = Number(insIssue.run("Conveyor C01", "Belt tension adjusted", e2At.toISOString(), "o-brian", "s-morning", "resolved").lastInsertRowid);
    recordEvent(db, { type: "equipment_issue_reported", operatorId: "o-brian", shiftId: "s-morning", at: e2At, payload: { issueId: e2, equipment: "Conveyor C01" } });
    eventCount += 2;
    exceptionCount++;

    return {
      products: PRODUCTS.length,
      locations: locationCount,
      purchaseOrders: pos.length,
      salesOrders: orders.length,
      movements: movementCount,
      events: eventCount,
      exceptions: exceptionCount,
    };
  });
}
