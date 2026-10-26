import type { Db } from "../db";
import type { ChatMessage, ModelPort } from "../ai/model-port";
import type { Card, ConversationContext } from "../copilot/cards";
import { routingSystemPrompt } from "../copilot/prompt";
import { executeDatabaseTool } from "../copilot/tool-executor";
import { COPILOT_TOOLS } from "../copilot/tools";
import { loadProducts } from "../domain/product-search";
import { sopAnswerPrompt } from "../copilot/prompt";

export const SOP_MIN_SCORE = 0.3;
export const SOP_REFUSAL =
  "I don't have an SOP for that. Ask your supervisor, or check the procedure binder.";

export interface AskInput {
  message: string;
  history?: ChatMessage[];
  context?: ConversationContext;
}

export type AskStreamEvent =
  | { type: "tool"; name: string; arguments: Record<string, unknown>; routedBy: "model" | "fallback" }
  | { type: "card"; card: Card }
  | { type: "token"; text: string }
  | { type: "context"; context: ConversationContext }
  | { type: "done"; reason: "complete" | "cancelled" | "error" };

export interface AskDeps {
  db: Db;
  model: ModelPort;
  now: () => Date;
}

const HELP =
  "I can help with stock levels, product locations, deliveries and warehouse procedures. Try asking about one of those.";

const PO_PATTERN = /\b(?:po|purchase\s+order)\s*(?:no\.?|number|#)?\s*(\d{3,})\b/i;

/**
 * Safety net used only when the model returns no usable tool call.
 * Model prose is never shown for a question that looks like warehouse work.
 */
export function fallbackRoute(message: string): { name: string; arguments: Record<string, unknown> } | null {
  const po = message.match(PO_PATTERN);
  if (po) return { name: "get_po", arguments: { po_number: po[1] } };
  if (/(below|under)\s+min|low\s+(on\s+)?stock|running\s+low|reorder|re-order|need\s+(to\s+)?restock/i.test(message)) {
    return { name: "list_below_minimum", arguments: {} };
  }
  if (/receiving\s+schedule|deliver(y|ies)|arriving|due\s+(today|tomorrow)|expected\s+today/i.test(message)) {
    return { name: "get_receiving_schedule", arguments: { date: /tomorrow/i.test(message) ? "tomorrow" : "today" } };
  }
  if (/\bwhere\b|which\s+(shelf|aisle|rack)|locat(ed|ion)|\bfind\b/i.test(message)) {
    return { name: "find_location", arguments: { query: message } };
  }
  if (/how\s+many|how\s+much|in\s+stock|\bstock\b|do\s+we\s+have/i.test(message)) {
    return { name: "get_stock_level", arguments: { query: message } };
  }
  if (/how\s+(do|should|can)\s+i|what\s+should\s+i|procedure|checklist|\bppe\b|safety|\bform\b|policy|spill|forklift|chemical|return(s)?\b|receiving\s+process/i.test(message)) {
    return { name: "search_sops", arguments: { question: message } };
  }
  return null;
}

function contextHint(db: Db, context: ConversationContext): string | undefined {
  if (!context.lastSku) return undefined;
  const product = loadProducts(db).find((p) => p.sku === context.lastSku);
  if (!product) return undefined;
  return `The product being discussed is ${product.name} (SKU ${product.sku}). If the user says "it" or "them", use SKU ${product.sku} as the query.`;
}

export async function* askCopilot(
  deps: AskDeps,
  input: AskInput,
  signal?: AbortSignal,
): AsyncIterable<AskStreamEvent> {
  const now = deps.now();
  const context = input.context ?? {};
  const recent = (input.history ?? []).slice(-4);
  const hint = contextHint(deps.db, context);
  const messages: ChatMessage[] = [
    { role: "system", content: routingSystemPrompt(now) },
    ...recent,
    { role: "user", content: hint ? `${input.message}\n\n(${hint})` : input.message },
  ];

  let call: { name: string; arguments: Record<string, unknown> } | null = null;
  let text = "";
  for await (const event of deps.model.ask({
    messages,
    tools: COPILOT_TOOLS,
    toolChoice: "required",
    maxTokens: 120,
    signal,
    cacheKey: "copilot-router",
  })) {
    if (event.type === "toolCall" && !call) {
      call = { name: event.name, arguments: event.arguments };
    } else if (event.type === "token") {
      text += event.text;
    } else if (event.type === "done" && event.stopReason === "cancelled") {
      yield { type: "done", reason: "cancelled" };
      return;
    }
  }
  if (signal?.aborted) {
    yield { type: "done", reason: "cancelled" };
    return;
  }

  let routedBy: "model" | "fallback" = "model";
  const knownTool = call ? COPILOT_TOOLS.some((t) => t.name === call!.name) : false;
  if (!call || !knownTool) {
    call = fallbackRoute(input.message);
    routedBy = "fallback";
  }

  if (!call) {
    yield { type: "token", text: text.trim() || HELP };
    yield { type: "done", reason: "complete" };
    return;
  }

  yield { type: "tool", name: call.name, arguments: call.arguments, routedBy };

  if (call.name === "search_sops") {
    yield* answerFromSops(deps, call.arguments, input.message, signal);
    return;
  }

  const outcome = executeDatabaseTool(deps.db, now, call.name, call.arguments, context);
  if (!outcome) {
    yield { type: "token", text: HELP };
    yield { type: "done", reason: "complete" };
    return;
  }
  yield { type: "card", card: outcome.card };
  yield { type: "token", text: outcome.text };
  if (outcome.context) yield { type: "context", context: { ...context, ...outcome.context } };
  yield { type: "done", reason: "complete" };
}

async function* answerFromSops(
  deps: AskDeps,
  args: Record<string, unknown>,
  message: string,
  signal?: AbortSignal,
): AsyncIterable<AskStreamEvent> {
  const question = typeof args.question === "string" && args.question.trim() ? args.question.trim() : message;
  let passages;
  try {
    passages = await deps.model.retrieveSop(question, 3);
  } catch {
    const text = "Procedure search is not ready. Open Readiness and run Prepare offline.";
    yield { type: "card", card: { kind: "notice", tone: "warning", text } };
    yield { type: "token", text };
    yield { type: "done", reason: "error" };
    return;
  }
  const usable = passages.filter((p) => p.score >= SOP_MIN_SCORE);
  const refuse = async function* (): AsyncIterable<AskStreamEvent> {
    yield { type: "card", card: { kind: "notice", tone: "info", text: "No matching SOP found." } };
    yield { type: "token", text: SOP_REFUSAL };
    yield { type: "done", reason: "complete" };
  };
  if (usable.length === 0) {
    yield* refuse();
    return;
  }

  let held = "";
  let decided = false;
  let streamed = "";
  for await (const event of deps.model.ask({
    messages: [
      { role: "system", content: sopAnswerPrompt(usable) },
      { role: "user", content: question },
    ],
    maxTokens: 220,
    signal,
  })) {
    if (event.type === "done" && event.stopReason === "cancelled") {
      yield { type: "done", reason: "cancelled" };
      return;
    }
    if (event.type !== "token") continue;
    if (decided) {
      streamed += event.text;
      yield { type: "token", text: event.text };
      continue;
    }
    held += event.text;
    if (held.length >= 14) {
      if (/NOT_COVERED/i.test(held)) {
        yield* refuse();
        return;
      }
      decided = true;
      streamed = held.replace(/^\s*ANSWER:\s*/i, "");
      yield { type: "token", text: streamed };
    }
  }
  if (!decided) {
    if (!held.trim() || /NOT_COVERED/i.test(held)) {
      yield* refuse();
      return;
    }
    streamed = held.replace(/^\s*ANSWER:\s*/i, "");
    yield { type: "token", text: streamed };
  }
  if (signal?.aborted) {
    yield { type: "done", reason: "cancelled" };
    return;
  }

  const seen = new Set<string>();
  const sources = usable
    .filter((p) => {
      const key = `${p.document}|${p.section}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({ document: p.document, section: p.section, excerpt: p.text }));
  yield { type: "card", card: { kind: "sop", sources } };
  yield { type: "done", reason: "complete" };
}
