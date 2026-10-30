import type { Card } from "@/lib/copilot/cards";
import { Icon } from "./icons";
import { StatusPill } from "./ui";

function CardFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      data-testid="record-card"
      aria-label={label}
      className="mt-3 rounded-control border border-line bg-canvas p-4"
    >
      {children}
    </div>
  );
}

export function CopilotCard({
  card,
  onPick,
}: {
  card: Card;
  onPick: (message: string) => void;
}) {
  switch (card.kind) {
    case "stock":
      return (
        <CardFrame label="Stock record">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="font-semibold">{card.product.name}</div>
              <div className="text-sm text-soft">
                SKU {card.product.sku} · {card.product.category}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold leading-none" data-testid="stock-total">
                {card.total}
              </div>
              <div className="text-sm text-soft">
                {card.product.unit}
                {card.total === 1 ? "" : "s"} in stock
              </div>
            </div>
          </div>
          {card.belowMinimum ? (
            <div className="mt-3">
              <StatusPill status="warning" label={`At or below minimum (${card.minStock})`} />
            </div>
          ) : null}
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-soft">
              <tr>
                <th className="py-1 font-medium">Location</th>
                <th className="py-1 text-right font-medium">Quantity</th>
                <th className="py-1 text-right font-medium">Last moved</th>
              </tr>
            </thead>
            <tbody>
              {card.locations.map((l) => (
                <tr key={l.locationId} className="border-t border-line">
                  <td className="py-1.5 font-medium">{l.locationId}</td>
                  <td className="py-1.5 text-right">{l.qty}</td>
                  <td className="py-1.5 text-right text-soft">{l.lastMovedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardFrame>
      );
    case "location":
      return (
        <CardFrame label="Location record">
          <div className="font-semibold">{card.product.name}</div>
          <div className="text-sm text-soft">SKU {card.product.sku}</div>
          <ul className="mt-2 divide-y divide-line">
            {card.locations.map((l) => (
              <li key={l.locationId} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{l.label}</span>
                <span className="text-soft">{l.qty} in stock</span>
              </li>
            ))}
          </ul>
        </CardFrame>
      );
    case "candidates":
      return (
        <CardFrame label="Which product">
          <div className="grid gap-2">
            {card.products.map((p) => (
              <button
                key={p.sku}
                type="button"
                onClick={() => onPick(`SKU ${p.sku}`)}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-control border border-line-strong bg-surface px-4 py-2 text-left hover:bg-sunk"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-soft">
                  SKU {p.sku} · {p.category}
                </span>
              </button>
            ))}
          </div>
        </CardFrame>
      );
    case "not_found":
      return (
        <CardFrame label="Not found">
          <div className="flex items-center gap-2 font-medium text-warn">
            <Icon name="info" size={20} />
            {card.what === "purchase_order" ? "No such purchase order" : "No matching product"}
            {card.query ? ` for “${card.query}”` : ""}
          </div>
        </CardFrame>
      );
    case "below_minimum":
      return (
        <CardFrame label="Products below minimum">
          {card.items.length === 0 ? (
            <div className="flex items-center gap-2 font-medium text-ok">
              <Icon name="check" size={20} /> Everything is above its minimum level.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-soft">
                <tr>
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 text-right font-medium">In stock</th>
                  <th className="py-1 text-right font-medium">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {card.items.map((i) => (
                  <tr key={i.sku} className="border-t border-line">
                    <td className="py-1.5">
                      <span className="font-medium">{i.name}</span>
                      <span className="block text-xs text-soft">SKU {i.sku}</span>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-bad">{i.total}</td>
                    <td className="py-1.5 text-right">{i.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardFrame>
      );
    case "schedule":
      return (
        <CardFrame label={card.label === "overdue" ? "Late deliveries" : "Receiving schedule"}>
          {card.orders.length === 0 ? (
            <div className="text-soft">
              {card.label === "overdue" ? "Nothing is behind schedule." : `No deliveries are due ${card.label}.`}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {card.orders.map((o) => (
                <li key={o.poNumber} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      PO {o.poNumber} · {o.supplier}
                    </span>
                    {o.status === "received" ? <StatusPill status="ok" label="Received" /> : null}
                    {o.daysLate !== undefined ? (
                      <span className="text-sm text-soft">
                        Due {o.expectedDate} · {o.daysLate} {o.daysLate === 1 ? "day" : "days"} late
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-soft">
                    {o.lines.map((l) => `${l.qty} × ${l.description}`).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardFrame>
      );
    case "po":
      return (
        <CardFrame label="Purchase order">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              PO {card.poNumber} · {card.supplier}
            </span>
            <span className="text-sm text-soft">Due {card.expectedDate}</span>
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {card.lines.map((l) => (
                <tr key={l.sku} className="border-t border-line">
                  <td className="py-1.5">
                    {l.description}
                    <span className="block text-xs text-soft">SKU {l.sku}</span>
                  </td>
                  <td className="py-1.5 text-right font-semibold">{l.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardFrame>
      );
    case "sop":
      return (
        <CardFrame label="Sources">
          <div className="text-sm font-medium text-soft">Sources</div>
          <ul className="mt-1 space-y-1">
            {card.sources.map((s) => (
              <li key={`${s.document}-${s.section}`}>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center gap-2">
                    <Icon name="info" size={18} />
                    <span className="font-medium">{s.document}</span>
                    <span className="text-soft">· {s.section}</span>
                  </summary>
                  <p className="whitespace-pre-line pb-2 pl-7 text-sm text-soft">{s.excerpt}</p>
                </details>
              </li>
            ))}
          </ul>
        </CardFrame>
      );
    case "notice":
      return (
        <CardFrame label="Notice">
          <div className={`flex items-center gap-2 font-medium ${card.tone === "warning" ? "text-warn" : "text-info"}`}>
            <Icon name="info" size={20} />
            {card.text}
          </div>
        </CardFrame>
      );
  }
}
