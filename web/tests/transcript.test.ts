import { describe, expect, it } from "vitest";
import { checkTranscript } from "@/lib/domain/transcript";

describe("checkTranscript", () => {
  it.each([
    "How many generators do we have?",
    "Where is item A340?",
    "What stock is below minimum levels?",
    "  Show   today's receiving schedule.  ",
  ])("keeps a real question: %j", (raw) => {
    const result = checkTranscript(raw);
    expect(result.ok).toBe(true);
    expect(result.text).toBe(raw.replace(/\s+/g, " ").trim());
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["[BLANK_AUDIO]", "silence"],
    ["(silence)", "silence"],
    ["[Music]", "silence"],
    ["*coughs*", "silence"],
    [".", "noise"],
    ["...", "noise"],
    ["Thank you.", "noise"],
    ["Thanks for watching!", "noise"],
    ["you", "noise"],
    ["Um", "noise"],
    ["ok", "too_short"],
  ])("rejects %j as %s", (raw, reason) => {
    const result = checkTranscript(raw);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(reason);
    expect(result.text).toBe("");
  });

  it("strips a noise tag that is mixed into real words", () => {
    expect(checkTranscript("[BLANK_AUDIO] where is the cement").text).toBe("where is the cement");
  });

  it("keeps a short but meaningful question", () => {
    expect(checkTranscript("Stock of cement").ok).toBe(true);
    expect(checkTranscript("PO 4471").ok).toBe(true);
  });
});
