"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelRole, ModelStatus, PrepareProgress } from "@/lib/ai/model-port";
import { streamEvents } from "@/lib/sse-client";
import { Icon } from "./icons";
import { Button, Panel, Skeleton, StatusPill } from "./ui";

const roleLabel: Record<ModelRole, { title: string; hint: string }> = {
  llm: { title: "Assistant", hint: "Understands questions and picks the right lookup" },
  embeddings: { title: "Procedure search", hint: "Finds the right section of your SOPs" },
  speech: { title: "Voice", hint: "Turns speech into text" },
  ocr: { title: "Reading documents", hint: "Reads delivery notes and loading sheets" },
  vision: { title: "Photo counting", hint: "Proposes a count from a shelf photo" },
  vad: { title: "Voice detection", hint: "Finds speech in audio" },
};

type PrepareEvent =
  | ({ type: "progress" } & PrepareProgress)
  | { type: "done" }
  | { type: "error"; message: string };

const mb = (bytes?: number) => (bytes ? `${Math.round(bytes / 1e6)} MB` : "");

export function ReadinessPanel() {
  const [models, setModels] = useState<ModelStatus[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/readiness");
    const data = await response.json();
    setModels(data.models as ModelStatus[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function prepare() {
    setRunning(true);
    setMessage(null);
    setProgress({});
    try {
      await streamEvents<PrepareEvent>("/api/readiness/prepare", {}, new AbortController().signal, (event) => {
        if (event.type === "progress") setProgress((p) => ({ ...p, [event.name]: event.percentage }));
        if (event.type === "error") setMessage({ tone: "bad", text: event.message });
        if (event.type === "done") {
          setMessage({ tone: "ok", text: "Everything is on this device. You can turn the network off." });
        }
      });
    } catch (e) {
      setMessage({ tone: "bad", text: (e as Error).message });
    } finally {
      setRunning(false);
      await load();
    }
  }

  async function resetDemo() {
    setConfirmReset(false);
    const response = await fetch("/api/admin/reseed", { method: "POST" });
    setMessage(
      response.ok
        ? { tone: "ok", text: "Demo data was reset to its starting state." }
        : { tone: "bad", text: "Could not reset the demo data." },
    );
  }

  const missing = models?.filter((m) => m.state === "missing") ?? [];
  const missingBytes = missing.reduce((sum, m) => sum + (m.sizeBytes ?? 0), 0);

  return (
    <div className="space-y-6">
      {message ? (
        <div
          role={message.tone === "bad" ? "alert" : "status"}
          data-testid="readiness-message"
          className={`flex items-start gap-3 rounded-control px-4 py-3 font-medium ${
            message.tone === "bad" ? "bg-bad-fill text-bad" : "bg-ok-fill text-ok"
          }`}
        >
          <Icon name={message.tone === "bad" ? "alert" : "check"} size={22} className="mt-0.5 shrink-0" />
          <span>{message.text}</span>
        </div>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold">Models on this device</h2>
            <p className="mt-1 text-sm text-soft">
              {models === null
                ? "Checking what is stored on this device."
                : missing.length === 0
                  ? "Everything the copilot needs is stored here. It works with the network off."
                  : `${missing.length} ${missing.length === 1 ? "model needs" : "models need"} to be downloaded once (${mb(missingBytes)}). After that, everything works offline.`}
            </p>
          </div>
          <Button
            variant="primary"
            icon="shield"
            onClick={prepare}
            disabled={running || models === null}
            data-testid="prepare-offline"
          >
            {running ? "Preparing…" : missing.length === 0 ? "Check and re-index procedures" : "Prepare offline"}
          </Button>
        </div>

        <ul className="mt-5 divide-y divide-line" data-testid="model-list">
          {models === null ? (
            <>
              <Skeleton className="my-2 h-14" />
              <Skeleton className="my-2 h-14" />
            </>
          ) : (
            models.map((m) => {
              const pct = progress[m.name];
              return (
                <li key={`${m.role}-${m.name}`} className="py-3" data-state={m.state}>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{roleLabel[m.role].title}</div>
                      <div className="text-sm text-soft">
                        {roleLabel[m.role].hint} · {m.name}
                        {m.sizeBytes ? ` · ${mb(m.sizeBytes)}` : ""}
                      </div>
                    </div>
                    {m.state === "missing" ? (
                      <StatusPill status="warning" label="Not on this device" />
                    ) : (
                      <StatusPill status="ok" label={m.state === "loaded" ? "Ready, in memory" : "Ready, stored"} />
                    )}
                  </div>
                  {running && pct !== undefined && pct < 100 ? (
                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunk"
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Downloading ${m.name}`}
                    >
                      <div className="h-full bg-signal transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">Demo data</h2>
        <p className="mt-1 text-sm text-soft">
          Put stock, orders and exceptions back to the starting state. This removes everything recorded since.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {confirmReset ? (
            <>
              <span className="font-medium">Reset all demo data?</span>
              <Button variant="danger" onClick={resetDemo}>
                Yes, reset
              </Button>
              <Button variant="quiet" onClick={() => setConfirmReset(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
