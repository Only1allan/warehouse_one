import { describe, expect, it } from "vitest";
import { recoverToolCall } from "@/lib/copilot/tool-recovery";
import { TOOL_NAMES } from "@/lib/copilot/tools";

describe("recoverToolCall", () => {
  it("reads Llama's own format, with parameters instead of arguments", () => {
    expect(recoverToolCall('{"name": "get_stock_level", "parameters": {"query": "generators"}}', TOOL_NAMES)).toEqual({
      name: "get_stock_level",
      arguments: { query: "generators" },
    });
  });

  it("reads the standard name and arguments format, including inside a tool_call tag", () => {
    expect(recoverToolCall('<tool_call>{"name":"get_po","arguments":{"po_number":"4471"}}</tool_call>', TOOL_NAMES)).toEqual({
      name: "get_po",
      arguments: { po_number: "4471" },
    });
  });

  it("reads a tool_calls list and an OpenAI-style function object", () => {
    expect(recoverToolCall('{"tool_calls":[{"name":"list_below_minimum","arguments":{}}]}', TOOL_NAMES)?.name).toBe("list_below_minimum");
    expect(recoverToolCall('{"function":{"name":"find_location","arguments":"{\\"query\\":\\"A340\\"}"}}', TOOL_NAMES)).toEqual({
      name: "find_location",
      arguments: { query: "A340" },
    });
  });

  it("ignores a thinking block and surrounding prose", () => {
    const text = '<think>The user wants the PO. {"name":"nonsense"}</think>Sure: {"name":"get_po","parameters":{"po_number":"4473"}} done.';
    expect(recoverToolCall(text, TOOL_NAMES)).toEqual({ name: "get_po", arguments: { po_number: "4473" } });
  });

  it("copes with braces inside string values", () => {
    expect(recoverToolCall('{"name":"search_sops","arguments":{"question":"what does {x} mean?"}}', TOOL_NAMES)?.arguments).toEqual({
      question: "what does {x} mean?",
    });
  });

  it("never accepts a tool that does not exist", () => {
    expect(recoverToolCall('{"name":"delete_stock","arguments":{"sku":"001254"}}', TOOL_NAMES)).toBeNull();
  });

  it.each(["", "I can only help with warehouse work.", "{not json}", '{"name": 5}', '{"name":"get_po"'])(
    "returns nothing for %j",
    (text) => {
      expect(recoverToolCall(text, TOOL_NAMES)).toBeNull();
    },
  );

  it("treats missing or odd arguments as empty", () => {
    expect(recoverToolCall('{"name":"list_below_minimum"}', TOOL_NAMES)).toEqual({ name: "list_below_minimum", arguments: {} });
    expect(recoverToolCall('{"name":"get_po","arguments":[1,2]}', TOOL_NAMES)?.arguments).toEqual({});
  });
});
