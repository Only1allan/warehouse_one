import type { Db } from "../db";
import type { ChatMessage, ModelPort } from "../ai/model-port";
import type { Card, ConversationContext } from "../copilot/cards";
import { routingSystemPrompt } from "../copilot/prompt";
import { executeDatabaseTool } from "../copilot/tool-executor";
import { COPILOT_TOOLS } from "../copilot/tools";
import { loadProducts } from "../domain/product-search";
import { normalizeSpokenNumbers } from "../domain/transcript";
import { sopAnswerPrompt } from "../copilot/prompt";

// Eval: every in-scope question scores >= 0.508; the highest off-topic question
// scores 0.379. A 0.4 threshold refuses the off-topic set without losing a real
// procedure. The model's NOT_COVERED check remains the second guard.
export const SOP_MIN_SCORE = 0.4;
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

const DATA_TOOLS = new Set([
  "get_stock_level",
  "find_location",
  "list_below_minimum",
  "get_receiving_schedule",
  "get_po",
]);

const OFF_TOPIC =
  /\b(joke|funny|capital of|weather|forecast|who are you|what are you|your name|tell me a story|poem|song|sing|movie|film|music|football|soccer|basketball|recipe|translate|president|prime minister|news|stock market|crypto|bitcoin)\b/i;

/** Questions whose wording also contains a data word ("how much") but clearly ask for a procedure. */
const PROCEDURE_HINT =
  /\b(procedure|policy|checklist|sop|safety data sheet|sds|weight limit|how much can (one|a) person|how much can i (lift|carry))\b/i;

/** Narrow deterministic check for obvious general-knowledge questions the 1B router is known to mishandle. */
export function isOffTopic(message: string): boolean {
  return OFF_TOPIC.test(message);
}

/**
 * Correct a model tool choice only when the deterministic router is confident
 * that the model picked the wrong kind of lookup. Returns null to keep the
 * model's choice.
 */
export function guardRoute(
  message: string,
  call: { name: string; arguments: Record<string, unknown> },
): { name: string; arguments: Record<string, unknown> } | null {
  const fallback = fallbackRoute(message);
  if (!fallback) return null;

  // Same tool: keep the model's arguments unless they are clearly wrong.
  if (fallback.name === call.name) {
    if (call.name === "get_po") {
      const expected = String(fallback.arguments.po_number ?? "");
      const actual = String(call.arguments.po_number ?? "").replace(/\D/g, "");
      if (actual !== expected) return fallback;
    }
    return null;
  }

  // A specific product-availability question must not become a below-minimum
  // list. The eval caught the 1B model choosing list_below_minimum for "Do we
  // have any pressure washers?"; the deterministic router is confident this is
  // a stock lookup.
  if (call.name === "list_below_minimum" && fallback.name === "get_stock_level") {
    return fallback;
  }

  const modelIsData = DATA_TOOLS.has(call.name);
  const fallbackIsData = DATA_TOOLS.has(fallback.name);
  const modelIsSop = call.name === "search_sops";
  const fallbackIsSop = fallback.name === "search_sops";

  // "How much can one person lift?" matches the data router's "how much" but is
  // a procedure question. Keep the model's SOP choice for wording like this.
  if (modelIsSop && fallbackIsData && PROCEDURE_HINT.test(message)) {
    return null;
  }

  // Only cross the data/procedure boundary. This fixes the known misses
  // without second-guessing two different data tools.
  if ((modelIsData && fallbackIsSop) || (modelIsSop && fallbackIsData)) {
    return fallback;
  }

  return null;
}

/** A category argument is only valid when the user named that category. */
function keepAskedCategory(
  message: string,
  call: { name: string; arguments: Record<string, unknown> },
): { name: string; arguments: Record<string, unknown> } | null {
  if (call.name !== "list_below_minimum") return null;
  const category = typeof call.arguments.category === "string" ? call.arguments.category.trim() : "";
  if (!category || message.toLowerCase().includes(category.toLowerCase())) return null;
  const rest = { ...call.arguments };
  delete rest.category;
  return { name: call.name, arguments: rest };
}

/**
 * Safety net used only when the model returns no usable tool call.
 * Model prose is never shown for a question that looks like warehouse work.
 */
export function fallbackRoute(message: string): { name: string; arguments: Record<string, unknown> } | null {
  // Procedure wording wins over data words such as "how much" or "where".
  if (PROCEDURE_HINT.test(message)) {
    return { name: "search_sops", arguments: { question: message } };
  }
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
  const normalizedMessage = normalizeSpokenNumbers(input.message);
  const messages: ChatMessage[] = [
    { role: "system", content: routingSystemPrompt(now) },
    ...recent,
    { role: "user", content: hint ? `${normalizedMessage}\n\n(${hint})` : normalizedMessage },
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
    call = fallbackRoute(normalizedMessage);
    routedBy = "fallback";
  }

  // The escape hatch must not swallow a warehouse question the rules can route.
  if (call?.name === "not_warehouse") {
    const fallback = fallbackRoute(normalizedMessage);
    if (fallback) {
      call = fallback;
      routedBy = "fallback";
    } else {
      yield { type: "tool", name: "not_warehouse", arguments: {}, routedBy };
      yield { type: "token", text: HELP };
      yield { type: "done", reason: "complete" };
      return;
    }
  }

  // A 1B router can still pick a warehouse tool for an obvious off-topic question.
  if (isOffTopic(normalizedMessage)) {
    yield { type: "tool", name: "not_warehouse", arguments: {}, routedBy: "fallback" };
    yield { type: "token", text: HELP };
    yield { type: "done", reason: "complete" };
    return;
  }

  if (call) {
    const guarded = guardRoute(normalizedMessage, call);
    if (guarded) {
      call = guarded;
      routedBy = "fallback";
    }
  }

  if (call) {
    const askedOnly = keepAskedCategory(normalizedMessage, call);
    if (askedOnly) {
      call = askedOnly;
      routedBy = "fallback";
    }
  }

  if (!call) {
    yield { type: "token", text: text.trim() || HELP };
    yield { type: "done", reason: "complete" };
    return;
  }

  yield { type: "tool", name: call.name, arguments: call.arguments, routedBy };

  if (call.name === "search_sops") {
    yield* answerFromSops(deps, call.arguments, normalizedMessage, signal);
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
