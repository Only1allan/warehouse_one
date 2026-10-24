export type ToolParameter = {
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: string[];
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AskRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "required" | "none" | string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type AskEvent =
  | { type: "token"; text: string }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }
  | { type: "stats"; timeToFirstTokenMs?: number; tokensPerSecond?: number }
  | { type: "done"; stopReason: "eos" | "length" | "cancelled" | "error" };

export interface SopChunk {
  document: string;
  section: string;
  text: string;
}

export interface SopPassage extends SopChunk {
  score: number;
}

export interface SopSourceDoc {
  name: string;
  markdown: string;
}

export interface DocumentLine {
  sku: string | null;
  description: string;
  quantity: number | null;
  confidence: number;
}

export type DocumentKind = "delivery_note" | "loading_sheet";

export interface DocumentRead {
  kind: DocumentKind;
  ocrText: string;
  reference: { value: string | null; confidence: number };
  party: { value: string | null; confidence: number };
  lines: DocumentLine[];
}

export interface CountProposal {
  count: number | null;
  note?: string;
}

export interface TranscriptionResult {
  text: string;
}

export type ModelRole =
  | "llm"
  | "embeddings"
  | "vision"
  | "ocr"
  | "speech"
  | "vad";

export interface ModelStatus {
  role: ModelRole;
  name: string;
  state: "missing" | "downloading" | "cached" | "loaded";
  sizeBytes?: number;
}

export interface PrepareProgress {
  role: ModelRole | "sops";
  name: string;
  percentage: number;
}

export interface ModelPort {
  ask(request: AskRequest): AsyncIterable<AskEvent>;
  ingestSops(docs: SopSourceDoc[]): Promise<{ chunks: number }>;
  retrieveSop(question: string, topK?: number): Promise<SopPassage[]>;
  transcribe(wav: Uint8Array): Promise<TranscriptionResult>;
  readDocument(image: Uint8Array, kind: DocumentKind): Promise<DocumentRead>;
  proposeCount(
    image: Uint8Array,
    context: { sku: string; productName: string },
  ): Promise<CountProposal>;
  readiness(): Promise<ModelStatus[]>;
  prepare(onProgress: (progress: PrepareProgress) => void): Promise<void>;
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelUnavailableError";
  }
}
