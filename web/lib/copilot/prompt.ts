import type { SopPassage } from "../ai/model-port";
import { dayKey } from "../time";

export function routingSystemPrompt(now: Date): string {
  return [
    "You are the Warehouse Operations Copilot, an assistant for warehouse operators.",
    `Today is ${dayKey(now)}.`,
    "You never know stock levels, locations, purchase orders or procedures from memory.",
    "For every warehouse question, call exactly one of the available tools.",
    "Use the user's own words for the required argument. Do not invent numbers.",
    "Only include optional arguments when the user names them. For list_below_minimum, omit category unless the user names a real product category. Never pass 'None', 'all' or 'running low'.",
    "If the question is not about warehouse operations, call not_warehouse with no arguments. Never use a warehouse tool for general knowledge, jokes, chat, weather or current events.",
  ].join(" ");
}

export function sopAnswerPrompt(passages: SopPassage[]): string {
  const numbered = passages
    .map((p, i) => `[${i + 1}] ${p.document} | ${p.section}\n${p.text}`)
    .join("\n\n");
  return [
    "You answer warehouse procedure and safety questions for operators.",
    "Use ONLY the numbered passages below. Do not use any other knowledge.",
    "Answer in at most 3 short sentences, or a short numbered list copied from the passages.",
    "Keep form numbers, locations and quantities exactly as written in the passages.",
    "If the passages do not answer the question, reply with exactly: NOT_COVERED",
    "",
    numbered,
  ].join("\n");
}
