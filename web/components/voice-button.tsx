"use client";

import { useEffect, useRef, useState } from "react";
import { toWav16kMono } from "@/lib/audio-wav";
import { Icon } from "./icons";

type Phase = "idle" | "recording" | "transcribing" | "heard" | "problem";

const SEND_DELAY_MS = 2000;

export function VoiceButton({
  onSend,
  onEdit,
  disabled,
  large,
}: {
  onSend: (text: string) => void;
  onEdit: (text: string) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (sendTimer.current) clearTimeout(sendTimer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function transcribe(blob: Blob) {
    setPhase("transcribing");
    try {
      const wav = await toWav16kMono(blob);
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: wav });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Could not transcribe that.");
      if (!data.ok) {
        setMessage(data.message);
        setPhase("problem");
        return;
      }
      setHeard(data.text);
      setPhase("heard");
      sendTimer.current = setTimeout(() => {
        onSend(data.text);
        setPhase("idle");
      }, SEND_DELAY_MS);
    } catch (e) {
      setMessage((e as Error).message);
      setPhase("problem");
    }
  }

  async function start() {
    if (disabled || phase === "recording") return;
    setMessage("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        void transcribe(new Blob(chunks.current, { type: rec.mimeType }));
      };
      rec.start();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setPhase("recording");
    } catch {
      setMessage("The microphone is not available. Allow it in the browser, or upload an audio file.");
      setPhase("problem");
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
  }

  function cancelSend() {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    setPhase("idle");
  }

  const base = large
    ? "inline-flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-panel border-2 px-6 text-2xl font-bold"
    : "inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-control border px-4 font-semibold";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="push-to-talk"
          aria-label={phase === "recording" ? "Release to send" : "Hold to talk"}
          aria-pressed={phase === "recording"}
          disabled={disabled || phase === "transcribing" || phase === "heard"}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            void start();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              if (phase === "recording") stop();
              else void start();
            }
          }}
          className={`${base} ${
            phase === "recording" ? "border-bad bg-bad text-white" : "border-line-strong bg-surface hover:bg-sunk"
          } disabled:opacity-45`}
        >
          <Icon name="mic" size={large ? 56 : 22} />
          {phase === "recording" ? `Listening… ${seconds}s` : large ? "Hold to talk, release to ask" : "Hold to talk"}
        </button>
        <label className="inline-flex min-h-14 cursor-pointer items-center rounded-control px-3 text-sm font-semibold underline underline-offset-4 hover:bg-sunk">
          Upload audio
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            aria-label="Upload an audio question"
            data-testid="audio-upload"
            disabled={disabled || phase === "recording" || phase === "transcribing"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void transcribe(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {phase === "transcribing" ? (
        <p className="text-sm font-medium text-soft" role="status">
          Listening to the recording…
        </p>
      ) : null}
      {phase === "heard" ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2"
          role="status"
          data-testid="heard"
        >
          <span className="font-medium">
            I heard: <q>{heard}</q>
          </span>
          <span className="text-sm text-soft">Sending in 2 seconds</span>
          <button
            type="button"
            onClick={() => {
              cancelSend();
              onEdit(heard);
            }}
            className="min-h-11 rounded-control border border-line-strong bg-surface px-4 font-semibold hover:bg-sunk"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={cancelSend}
            className="min-h-11 rounded-control border border-line-strong bg-surface px-4 font-semibold hover:bg-sunk"
          >
            Cancel
          </button>
        </div>
      ) : null}
      {phase === "problem" ? (
        <p className="flex items-start gap-2 text-sm font-medium text-warn" role="alert" data-testid="voice-problem">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
