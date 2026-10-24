export interface TranscriptCheck {
  ok: boolean;
  text: string;
  reason?: "empty" | "silence" | "too_short" | "noise";
}

const NOISE_TAGS = /^\s*[\[(<*][^\])>*]*[\])>*]\s*$/;
const KNOWN_HALLUCINATIONS = new Set([
  "you",
  "thank you",
  "thanks for watching",
  "thank you for watching",
  "bye",
  "bye bye",
  "so",
  "uh",
  "um",
  "hmm",
  "the",
]);

/**
 * Speech models invent text from near-silent audio ("[BLANK_AUDIO]", "Thank you."). A transcript
 * that looks like that must never be sent to the copilot as a question.
 */
export function checkTranscript(raw: string): TranscriptCheck {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, text: "", reason: "empty" };
  if (NOISE_TAGS.test(text)) return { ok: false, text: "", reason: "silence" };
  const cleaned = text.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { ok: false, text: "", reason: "silence" };
  const normalised = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (!normalised) return { ok: false, text: "", reason: "noise" };
  if (KNOWN_HALLUCINATIONS.has(normalised)) return { ok: false, text: "", reason: "noise" };
  const words = normalised.split(" ").filter(Boolean);
  if (words.length < 2 && normalised.length < 4) return { ok: false, text: "", reason: "too_short" };
  return { ok: true, text: cleaned };
}

export const TRANSCRIPT_MESSAGES: Record<NonNullable<TranscriptCheck["reason"]>, string> = {
  empty: "I did not hear anything. Hold the button and speak, then let go.",
  silence: "I only heard silence. Move closer and try again.",
  too_short: "That was too short to understand. Try asking the whole question.",
  noise: "I could not make out a question. Try again in a quieter spot.",
};
