import { cancel, completion, loadModel } from "@qvac/sdk";
import {
  ModelUnavailableError,
  type AskEvent,
  type AskRequest,
  type CountProposal,
  type DocumentRead,
  type ModelPort,
  type ModelStatus,
  type SopPassage,
  type TranscriptionResult,
} from "../model-port";
import { getModelManager } from "./model-manager";
import { MODELS } from "./models";

const notYet = (what: string) =>
  new ModelUnavailableError(`${what} is not available yet`);

export class QvacModelPort implements ModelPort {
  private readonly models = getModelManager();

  constructor() {
    this.models.register(
      "llm",
      () =>
        loadModel({ modelSrc: MODELS.llm.src, modelType: "llm" }) as Promise<string>,
      true,
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
            stopReason:
              event.stopReason === "stopSequence" || !event.stopReason
                ? "eos"
                : event.stopReason,
          };
        }
      }
    } finally {
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  async ingestSops(): Promise<{ chunks: number }> {
    throw notYet("SOP ingestion");
  }

  async retrieveSop(): Promise<SopPassage[]> {
    throw notYet("SOP retrieval");
  }

  async transcribe(): Promise<TranscriptionResult> {
    throw notYet("Speech to text");
  }

  async readDocument(): Promise<DocumentRead> {
    throw notYet("Document reading");
  }

  async proposeCount(): Promise<CountProposal> {
    throw notYet("Count proposal");
  }

  async readiness(): Promise<ModelStatus[]> {
    return [
      {
        role: "llm",
        name: MODELS.llm.name,
        state: this.models.isLoaded("llm") ? "loaded" : "cached",
      },
    ];
  }

  async prepare() {
    await this.models.get("llm");
  }
}

const globalForPort = globalThis as unknown as { __qvacPort?: QvacModelPort };

export function getModelPort(): QvacModelPort {
  if (!globalForPort.__qvacPort) globalForPort.__qvacPort = new QvacModelPort();
  return globalForPort.__qvacPort;
}
