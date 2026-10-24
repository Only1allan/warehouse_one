"use client";

import { useRef, useState } from "react";

export default function SpikePage() {
  const [prompt, setPrompt] = useState("Say hello to a warehouse operator in one short sentence.");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function send() {
    setOutput("");
    setBusy(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch("/api/spike/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const event = JSON.parse(frame.replace(/^data: /, ""));
          if (event.type === "token") setOutput((o) => o + event.text);
          if (event.type === "error") setOutput((o) => o + `\n[error] ${event.message}`);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") throw error;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>QVAC spike</h1>
      <textarea
        aria-label="Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <button onClick={send} disabled={busy}>Send</button>
        <button onClick={() => controllerRef.current?.abort()} disabled={!busy}>Stop</button>
      </div>
      <pre data-testid="output" style={{ whiteSpace: "pre-wrap" }}>{output}</pre>
    </main>
  );
}
