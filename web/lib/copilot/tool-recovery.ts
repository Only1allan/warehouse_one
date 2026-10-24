export interface RecoveredCall {
  name: string;
  arguments: Record<string, unknown>;
}

function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function fromObject(value: unknown, toolNames: string[]): RecoveredCall | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.tool_calls) && obj.tool_calls.length > 0) return fromObject(obj.tool_calls[0], toolNames);
  const inner = obj.function && typeof obj.function === "object" ? (obj.function as Record<string, unknown>) : obj;
  const name = typeof inner.name === "string" ? inner.name : null;
  if (!name || !toolNames.includes(name)) return null;
  const raw = inner.arguments ?? inner.parameters ?? inner.args ?? {};
  let args: unknown = raw;
  if (typeof raw === "string") {
    try {
      args = JSON.parse(raw);
    } catch {
      args = {};
    }
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) args = {};
  return { name, arguments: args as Record<string, unknown> };
}

/**
 * Some small models write a correct tool call as plain JSON text, in their own dialect
 * ("parameters" instead of "arguments"). This reads it back, accepting only known tool names.
 */
export function recoverToolCall(text: string, toolNames: string[]): RecoveredCall | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, " ").replace(/<\/?tool_call>/g, " ");
  const json = firstJsonObject(cleaned);
  if (!json) return null;
  try {
    return fromObject(JSON.parse(json), toolNames);
  } catch {
    return null;
  }
}
