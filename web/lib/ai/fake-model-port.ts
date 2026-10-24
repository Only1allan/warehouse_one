import type {
  AskEvent,
  AskRequest,
  CountProposal,
  DocumentKind,
  DocumentRead,
  ModelPort,
  ModelStatus,
  PrepareProgress,
  SopPassage,
  SopSourceDoc,
  TranscriptionResult,
} from "./model-port";

export interface ScriptedTurn {
  tokens?: string[];
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export class FakeModelPort implements ModelPort {
  readonly askRequests: AskRequest[] = [];
  readonly ingested: SopSourceDoc[] = [];
  turns: ScriptedTurn[] = [];
  sopPassages: SopPassage[] = [];
  transcript = "";
  documentRead: DocumentRead | null = null;
  countProposal: CountProposal = { count: null };
  statuses: ModelStatus[] = [];
  tokenDelayMs = 0;

  queueTurn(turn: ScriptedTurn): this {
    this.turns.push(turn);
    return this;
  }

  async *ask(request: AskRequest): AsyncIterable<AskEvent> {
    this.askRequests.push(request);
    const turn = this.turns.shift() ?? { tokens: [] };
    let index = 0;
    for (const call of turn.toolCalls ?? []) {
      if (request.signal?.aborted) {
        yield { type: "done", stopReason: "cancelled" };
        return;
      }
      yield {
        type: "toolCall",
        id: `call-${++index}`,
        name: call.name,
        arguments: call.arguments,
      };
    }
    for (const text of turn.tokens ?? []) {
      if (request.signal?.aborted) {
        yield { type: "done", stopReason: "cancelled" };
        return;
      }
      if (this.tokenDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.tokenDelayMs));
      }
      yield { type: "token", text };
    }
    yield { type: "done", stopReason: "eos" };
  }

  async ingestSops(docs: SopSourceDoc[]): Promise<{ chunks: number }> {
    this.ingested.push(...docs);
    return { chunks: docs.length };
  }

  async retrieveSop(): Promise<SopPassage[]> {
    return this.sopPassages;
  }

  async transcribe(): Promise<TranscriptionResult> {
    return { text: this.transcript };
  }

  async readDocument(
    _image: Uint8Array,
    kind: DocumentKind,
  ): Promise<DocumentRead> {
    if (!this.documentRead) {
      return {
        kind,
        ocrText: "",
        reference: { value: null, confidence: 0 },
        party: { value: null, confidence: 0 },
        lines: [],
      };
    }
    return this.documentRead;
  }

  async proposeCount(): Promise<CountProposal> {
    return this.countProposal;
  }

  async readiness(): Promise<ModelStatus[]> {
    return this.statuses;
  }

  async prepare(onProgress: (progress: PrepareProgress) => void) {
    onProgress({ role: "llm", name: "fake", percentage: 100 });
  }
}
