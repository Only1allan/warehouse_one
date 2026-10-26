import * as sdk from "@qvac/sdk";
import type { ModelRole } from "../model-port";

const S = sdk as unknown as Record<string, { name: string; src: string }>;

function model(constantName: string) {
  const found = S[constantName];
  if (!found) throw new Error(`Unknown QVAC model constant ${constantName}`);
  return found;
}

/**
 * The models the copilot uses. Chosen by measurement on the target machine
 * (CPU only, about 8 GB of memory). See docs/04-decisions.md for the evidence.
 */
export const MODELS = {
  llm: { constant: "LLAMA_3_2_1B_INST_Q4_0", contextSize: 4096, reasoningBudget: undefined as number | undefined },
  embeddings: { constant: "EMBEDDINGGEMMA_300M_Q4_0" },
  speech: { constant: "PARAKEET_TDT_0_6B_V3_Q8_0", engine: "parakeet-transcription" as const },
  ocr: {
    constant: "OCR_LATIN",
    config: {
      langList: ["en"],
      magRatio: 1.0,
      defaultRotationAngles: [] as number[],
      contrastRetry: false,
      lowConfidenceThreshold: 0.5,
      recognizerBatchSize: 1,
    },
  },
  vision: {
    constant: "SMOLVLM2_500M_MULTIMODAL_Q8_0",
    projection: "MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0",
  },
} as const;

export interface ModelAsset {
  role: ModelRole;
  name: string;
  src: string;
}

export const src = (constantName: string) => model(constantName).src;

/** Every file the app needs, for readiness and Prepare offline. */
export function requiredAssets(): ModelAsset[] {
  return [
    { role: "llm", name: MODELS.llm.constant, src: model(MODELS.llm.constant).src },
    { role: "embeddings", name: MODELS.embeddings.constant, src: model(MODELS.embeddings.constant).src },
    { role: "speech", name: MODELS.speech.constant, src: model(MODELS.speech.constant).src },
    { role: "ocr", name: MODELS.ocr.constant, src: model(MODELS.ocr.constant).src },
    { role: "vision", name: MODELS.vision.constant, src: model(MODELS.vision.constant).src },
    { role: "vision", name: MODELS.vision.projection, src: model(MODELS.vision.projection).src },
  ];
}
