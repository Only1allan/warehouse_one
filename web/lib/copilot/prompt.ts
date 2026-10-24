import type { SopPassage } from "../ai/model-port";
import { dayKey } from "../time";

export function routingSystemPrompt(now: Date, contextHint?: string): string {
  return [
    "You are the Warehouse Operations Copilot, an assistant for warehouse operators.",
    `Today is ${dayKey(now)}.`,
    ...(contextHint ? [contextHint] : []),
    "You never know stock levels, locations, purchase orders or procedures from memory.",
    "For every question, call exactly one of the available tools with the user's own words as arguments.",
    "If the question is not about warehouse operations, answer briefly that you can only help with warehouse work.",
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
