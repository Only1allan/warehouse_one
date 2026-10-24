import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cancel,
  completion,
  downloadAsset,
  getModelInfo,
  loadModel,
  ocr,
  ragCloseWorkspace,
  ragDeleteWorkspace,
  ragIngest,
  ragListWorkspaces,
  ragSearch,
  transcribe,
} from "@qvac/sdk";
import {
  chunkSop,
  chunkToIndexText,
  indexTextToChunk,
  loadSopDocuments,
  SOP_WORKSPACE,
} from "../../copilot/sop";
import {
  buildDocumentRead,
  EXTRACTION_SCHEMA,
  extractionPrompt,
  ocrBlocksToText,
  type OcrBlock,
} from "../document-extraction";
import {
  ModelUnavailableError,
  type AskEvent,
  type AskRequest,
  type CountProposal,
  type DocumentKind,
  type DocumentRead,
  type ModelPort,
  type ModelStatus,
  type PrepareProgress,
  type SopPassage,
  type SopSourceDoc,
  type TranscriptionResult,
} from "../model-port";
import { getModelManager } from "./model-manager";
import { MODELS, requiredAssets, src } from "./models";


function withTempFile<T>(bytes: Uint8Array, extension: string, use: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `wh-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  fs.writeFileSync(file, bytes);
  return use(file).finally(() => fs.rmSync(file, { force: true }));
}

export class QvacModelPort implements ModelPort {
  private readonly models = getModelManager();
  private sopIndexReady: Promise<void> | null = null;
  private warming: Promise<void> | null = null;
  private warmFailure: string | null = null;

  constructor() {
    this.models.register(
      "llm",
      () => loadModel({ modelSrc: src(MODELS.llm.constant), modelType: "llm" }) as Promise<string>,
      true,
    );
    this.models.register(
      "embeddings",
      () => loadModel({ modelSrc: src(MODELS.embeddings.constant), modelType: "embeddings" }) as Promise<string>,
      true,
    );
    this.models.register(
      "speech",
      () =>
        loadModel({ modelSrc: src(MODELS.speech.constant), modelType: MODELS.speech.engine } as never) as Promise<string>,
      false,
    );
    this.models.register(
      "ocr",
      () =>
        loadModel({ modelSrc: src(MODELS.ocr.constant), modelConfig: { ...MODELS.ocr.config } } as never) as Promise<string>,
      false,
    );
    this.models.register(
      "vision",
      () =>
        loadModel({
          modelSrc: src(MODELS.vision.constant),
          modelType: "llm",
          modelConfig: { ctx_size: 2048, projectionModelSrc: src(MODELS.vision.projection) },
        } as never) as Promise<string>,
      false,
    );
  }

  async *ask(request: AskRequest): AsyncIterable<AskEvent> {
    const modelId = await this.models.get("llm");
    const run = completion({
      modelId,
      history: request.messages,
      stream: true,
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: "function" as const,
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          }
        : {}),
      generationParams: {
        temp: 0,
        ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
        ...(request.maxTokens ? { predict: request.maxTokens } : {}),
      },
    });

    const onAbort = () => {
      void cancel({ requestId: run.requestId }).catch(() => undefined);
    };
    if (request.signal?.aborted) onAbort();
    request.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      for await (const event of run.events) {
        if (event.type === "contentDelta") {
          yield { type: "token", text: event.text };
        } else if (event.type === "toolCall") {
          yield {
            type: "toolCall",
            id: event.call.id,
            name: event.call.name,
            arguments: event.call.arguments,
          };
        } else if (event.type === "completionStats") {
          yield {
            type: "stats",
            timeToFirstTokenMs: event.stats.timeToFirstToken,
            tokensPerSecond: event.stats.tokensPerSecond,
          };
        } else if (event.type === "completionDone") {
          yield {
            type: "done",
            stopReason: event.stopReason === "stopSequence" || !event.stopReason ? "eos" : event.stopReason,
          };
        }
      }
    } finally {
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  async ingestSops(docs: SopSourceDoc[]): Promise<{ chunks: number }> {
    const modelId = await this.models.get("embeddings");
    const chunks = docs.flatMap(chunkSop);
    try {
      await ragCloseWorkspace({ workspace: SOP_WORKSPACE });
      await ragDeleteWorkspace({ workspace: SOP_WORKSPACE });
    } catch {
      // The workspace does not exist yet on a first run.
    }
    await ragIngest({
      workspace: SOP_WORKSPACE,
      modelId,
      documents: chunks.map(chunkToIndexText),
      chunk: false,
    });
    return { chunks: chunks.length };
  }

  private ensureSopIndex(): Promise<void> {
    if (!this.sopIndexReady) {
      this.sopIndexReady = (async () => {
        const existing = await ragListWorkspaces().catch(() => []);
        if (!existing.some((w) => w.name === SOP_WORKSPACE)) {
          await this.ingestSops(loadSopDocuments());
        }
      })().catch((error) => {
        this.sopIndexReady = null;
        throw error;
      });
    }
    return this.sopIndexReady;
  }

  async retrieveSop(question: string, topK = 3): Promise<SopPassage[]> {
    await this.ensureSopIndex();
    const modelId = await this.models.get("embeddings");
    const results = await ragSearch({ workspace: SOP_WORKSPACE, modelId, query: question, topK });
    const passages: SopPassage[] = [];
    for (const result of results) {
      const chunk = indexTextToChunk(result.content);
      if (chunk) passages.push({ ...chunk, score: result.score });
    }
    return passages;
  }

  async transcribe(wav: Uint8Array): Promise<TranscriptionResult> {
    const modelId = await this.models.get("speech");
    const text = await withTempFile(wav, ".wav", (file) =>
      transcribe({ modelId, audioChunk: file } as never) as unknown as Promise<string>,
    );
    return { text: String(text).trim() };
  }

  async readDocument(image: Uint8Array, kind: DocumentKind): Promise<DocumentRead> {
    const ocrId = await this.models.get("ocr");
    const blocks = await withTempFile(image, ".png", async (file) => {
      const { blocks: pending } = ocr({ modelId: ocrId, image: file, options: { paragraph: false } } as never);
      return (await pending) as OcrBlock[];
    });
    const ocrText = ocrBlocksToText(blocks);
    if (!ocrText) return buildDocumentRead(kind, "", "{}");

    const llmId = await this.models.get("llm");
    const run = completion({
      modelId: llmId,
      history: [{ role: "user", content: extractionPrompt(kind, ocrText) }],
      stream: true,
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "document_extraction", schema: EXTRACTION_SCHEMA },
      },
      generationParams: { temp: 0, predict: 600 },
    } as never);
    let raw = "";
    for await (const event of run.events) {
      if (event.type === "contentDelta") raw += event.text;
    }
    return buildDocumentRead(kind, ocrText, raw);
  }

  async proposeCount(
    image: Uint8Array,
    context: { sku: string; productName: string },
  ): Promise<CountProposal> {
    const modelId = await this.models.get("vision");
    const text = await withTempFile(image, ".jpg", async (file) => {
      const run = completion({
        modelId,
        history: [
          {
            role: "user",
            content: `Count the ${context.productName} items (boxes, cartons or units) on the shelves in this photo. Reply with only the number.`,
            attachments: [{ path: file }],
          },
        ],
        stream: true,
        generationParams: { temp: 0, predict: 24 },
      } as never);
      let out = "";
      for await (const event of run.events) {
        if (event.type === "contentDelta") out += event.text;
      }
      return out;
    });
    const match = text.match(/\d+/);
    if (!match) return { count: null, note: "The model could not give a number for this photo." };
    return { count: Number(match[0]) };
  }

  /** Loads the always-resident models if their files are already on this device. Never downloads. */
  warmUp(): void {
    if (this.warming) return;
    this.warming = (async () => {
      const statuses = await this.readiness();
      const resident = statuses.filter((s) => s.role === "llm" || s.role === "embeddings");
      if (resident.some((s) => s.state === "missing")) {
        this.warmFailure = "Some models are not on this device yet.";
        return;
      }
      await Promise.all([this.models.get("llm"), this.models.get("embeddings")]);
      this.warmFailure = null;
    })()
      .catch((error: unknown) => {
        this.warmFailure = error instanceof Error ? error.message : "Warm-up failed.";
      })
      .finally(() => {
        this.warming = null;
      });
  }

  warmState(): { llm: boolean; embeddings: boolean; busy: boolean; problem: string | null } {
    return {
      llm: this.models.isLoaded("llm"),
      embeddings: this.models.isLoaded("embeddings"),
      busy: this.warming !== null,
      problem: this.warmFailure,
    };
  }

  async readiness(): Promise<ModelStatus[]> {
    const statuses: ModelStatus[] = [];
    for (const asset of requiredAssets()) {
      try {
        const info = await getModelInfo({ name: asset.name });
        statuses.push({
          role: asset.role,
          name: asset.name,
          state: info.isLoaded ? "loaded" : info.isCached ? "cached" : "missing",
          sizeBytes: info.expectedSize,
        });
      } catch {
        statuses.push({ role: asset.role, name: asset.name, state: "missing" });
      }
    }
    return statuses;
  }

  async prepare(onProgress: (progress: PrepareProgress) => void): Promise<void> {
    for (const asset of requiredAssets()) {
      const info = await getModelInfo({ name: asset.name }).catch(() => null);
      if (info?.isCached) {
        onProgress({ role: asset.role, name: asset.name, percentage: 100 });
        continue;
      }
      await downloadAsset({
        assetSrc: asset.src,
        onProgress: (p: { percentage: number }) =>
          onProgress({ role: asset.role, name: asset.name, percentage: p.percentage }),
      } as never);
      onProgress({ role: asset.role, name: asset.name, percentage: 100 });
    }
    onProgress({ role: "sops", name: "Procedures", percentage: 0 });
    const result = await this.ingestSops(loadSopDocuments());
    this.sopIndexReady = Promise.resolve();
    onProgress({ role: "sops", name: `Procedures (${result.chunks} sections)`, percentage: 100 });
  }
}

const globalForPort = globalThis as unknown as { __qvacPort?: QvacModelPort };

export function getModelPort(): QvacModelPort {
  if (!globalForPort.__qvacPort) globalForPort.__qvacPort = new QvacModelPort();
  return globalForPort.__qvacPort;
}

export { ModelUnavailableError };
