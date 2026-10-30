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

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const DIGIT_WORD = "(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)";
const SPOKEN_NUMBER = new RegExp(`\\b${DIGIT_WORD}(?:[\\s-]+${DIGIT_WORD}){2,}\\b`, "gi");

/** Converts "four four seven one" -> "4471", "zero zero one two five four" -> "001254". */
export function normalizeSpokenNumbers(text: string): string {
  return text.replace(SPOKEN_NUMBER, (match) =>
    match
      .toLowerCase()
      .split(/[\s-]+/)
      .map((word) => DIGIT_WORDS[word])
      .join(""),
  );
}

/**
 * Parakeet mishears a few words from this warehouse's vocabulary. Correct only the
 * errors observed in the fixtures; a broad spell-checker would create new mistakes.
 */
const DOMAIN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bgraders\b/gi, "generators"],
  [/\bgrader\b/gi, "generator"],
  [/\bgeneraters\b/gi, "generators"],
  [/\bgenerater\b/gi, "generator"],
  [/\bgen[\s-]?sets\b/gi, "generators"],
  [/\bgen[\s-]?set\b/gi, "generator"],
];

export function correctDomainTerms(text: string): {
  text: string;
  corrections: Array<{ from: string; to: string }>;
} {
  let output = text;
  const corrections: Array<{ from: string; to: string }> = [];
  for (const [pattern, replacement] of DOMAIN_REPLACEMENTS) {
    output = output.replace(pattern, (match) => {
      corrections.push({ from: match, to: replacement });
      return replacement;
    });
  }
  return { text: output, corrections };
}
