"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, ConversationContext } from "@/lib/copilot/cards";
import type { AskStreamEvent } from "@/lib/services/ask";
import { streamEvents } from "@/lib/sse-client";
import { CopilotCard } from "./copilot-cards";
import { Icon } from "./icons";
import { VoiceButton } from "./voice-button";
import { Button, Panel, Skeleton } from "./ui";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  cards: Card[];
  state: "streaming" | "done" | "stopped" | "error";
}

const EXAMPLES = [
  "How many generators do we have?",
  "Where is SKU 001254 stored?",
  "What stock is below minimum levels?",
  "Show today's receiving schedule.",
  "What should I do with damaged inventory?",
];

export function AskChat({
  examples = EXAMPLES,
  introTitle = "Try asking",
  introText = "Stock and location answers use the inventory records. Procedure answers cite their source.",
  voiceFirst = false,
}: {
  examples?: string[];
  introTitle?: string;
  introText?: string;
  voiceFirst?: boolean;
} = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState<ConversationContext>({});
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function patchLast(update: (m: Message) => Message) {
    setMessages((all) => all.map((m, i) => (i === all.length - 1 ? update(m) : m)));
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    const history = messages
      .filter((m) => m.state !== "error" && m.text)
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.text }));
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    setMessages((all) => [
      ...all,
      { id: ++idRef.current, role: "user", text: message, cards: [], state: "done" },
      { id: ++idRef.current, role: "assistant", text: "", cards: [], state: "streaming" },
    ]);
    try {
      await streamEvents<AskStreamEvent | { type: "error"; message: string }>(
        "/api/ask",
        { message, history, context },
        controller.signal,
        (event) => {
          if (event.type === "card") patchLast((m) => ({ ...m, cards: [...m.cards, event.card] }));
          else if (event.type === "token") patchLast((m) => ({ ...m, text: m.text + event.text }));
          else if (event.type === "context") setContext(event.context);
          else if (event.type === "done") {
            patchLast((m) => ({ ...m, state: event.reason === "cancelled" ? "stopped" : "done" }));
          } else if (event.type === "error") {
            patchLast((m) => ({ ...m, text: event.message, state: "error" }));
          }
        },
      );
      patchLast((m) => (m.state === "streaming" ? { ...m, state: "done" } : m));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        patchLast((m) => ({ ...m, state: "stopped" }));
      } else {
        patchLast((m) => ({ ...m, text: (error as Error).message, state: "error" }));
      }
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="space-y-5" data-testid="conversation">
        {messages.length === 0 ? (
          <Panel>
            <h2 className="text-lg font-semibold">{introTitle}</h2>
            <p className="mt-1 text-sm text-soft">{introText}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  className="min-h-14 rounded-control border border-line-strong bg-surface px-4 py-2 text-left font-medium hover:bg-sunk"
                >
                  {example}
                </button>
              ))}
            </div>
          </Panel>
        ) : null}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p
                data-testid="user-message"
                className="max-w-[85%] rounded-panel bg-signal px-4 py-3 font-medium text-ink"
              >
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%]" data-testid="assistant-message" data-state={m.state}>
              <Panel className="!p-4">
                {m.state === "streaming" && !m.text && m.cards.length === 0 ? (
                  <div className="space-y-2" aria-label="Working on it">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                ) : null}
                {m.text ? (
                  <p className={m.state === "error" ? "font-medium text-bad" : ""} data-testid="answer-text">
                    {m.text}
                  </p>
                ) : null}
                {m.cards.map((card, i) => (
                  <CopilotCard key={i} card={card} onPick={send} />
                ))}
                {m.state === "stopped" ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-soft">
                    <Icon name="stop" size={16} /> Stopped
                  </p>
                ) : null}
              </Panel>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {voiceFirst ? (
        <div className="order-first" data-testid="hands-free">
          <VoiceButton large onSend={(text) => void send(text)} onEdit={setInput} disabled={busy} />
        </div>
      ) : null}
      <div className="sticky bottom-24 z-[5] space-y-2 rounded-panel border border-line bg-surface p-2 shadow-panel md:bottom-4">
      {voiceFirst ? null : <VoiceButton onSend={(text) => void send(text)} onEdit={setInput} disabled={busy} />}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          aria-label="Your question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about stock, locations, deliveries or procedures"
          autoComplete="off"
          className="h-14 min-w-0 flex-1 rounded-control border border-line-strong bg-canvas px-4"
        />
        {busy ? (
          <Button icon="stop" variant="secondary" onClick={() => controllerRef.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button type="submit" icon="send" variant="primary" disabled={!input.trim()}>
            Ask
          </Button>
        )}
      </form>
      </div>
    </div>
  );
}
