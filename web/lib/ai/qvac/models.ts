import { LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

// Provisional choices from the spike. Ticket 04 replaces these with measured picks.
export const MODELS = {
  llm: { name: "LLAMA_3_2_1B_INST_Q4_0", src: LLAMA_3_2_1B_INST_Q4_0 },
} as const;
