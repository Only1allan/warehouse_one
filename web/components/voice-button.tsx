"use client";

import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/api-client";
import { toWav16kMono } from "@/lib/audio-wav";
import { Icon } from "./icons";

type Phase = "idle" | "recording" | "transcribing" | "heard" | "problem";

const MAX_RECORDING_MS = 15_000;
const TRANSCRIBE_TIMEOUT_MS = 120_000;

interface Correction {
  from: string;
  to: string;
}

export function VoiceButton({
  onSend,
  onEdit,
  disabled,
  large,
  autoSendMs = null,
}: {
  onSend: (text: string) => void;
  onEdit: (text: string) => void;
  disabled?: boolean;
  large?: boolean;
  autoSendMs?: number | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [warming, setWarming] = useState(large === true);

  const mounted = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  const wantRecording = useRef(false);
  const starting = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function setPhaseSafe(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  // Load the speech model while the operator gets ready, so the first recording is not a
  // silent 30-second wait. The request is intentionally not awaited by the UI.
  useEffect(() => {
    if (!large) return;
    let active = true;
    void fetch("/api/voice/warm", { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        if (active) setWarming(false);
      });
    return () => {
      active = false;
    };
  }, [large]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      wantRecording.current = false;
      if (timer.current) clearInterval(timer.current);
      if (maxTimer.current) clearTimeout(maxTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      abortRef.current?.abort();
      const rec = recorder.current;
      if (rec) {
        rec.onstop = null;
        if (rec.state !== "inactive") rec.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetHeard() {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setCountdown(0);
    setHeard("");
    setCorrections([]);
  }

  async function transcribe(blob: Blob) {
    // A new clip replaces any previous "I heard" text, including a countdown.
    resetHeard();
    setPhaseSafe("transcribing");
    setElapsed(0);
    const elapsedTimer = setInterval(() => setElapsed((value) => value + 1), 1000);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

    try {
      const wav = await toWav16kMono(blob);
      const response = await request("/api/voice/transcribe", {
        method: "POST",
        body: wav,
        signal: controller.signal,
      });

      const raw = await response.text();
      let data: {
        text?: string;
        ok?: boolean;
        message?: string;
        original?: string;
        corrections?: Correction[];
        error?: { message?: string };
      };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("The voice service returned an unexpected response. Try again.");
      }

      if (!response.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? "Could not transcribe that.");
      }
      if (!data.ok) {
        if (!mounted.current) return;
        setMessage(data.message ?? "I could not make out a question.");
        setPhaseSafe("problem");
        return;
      }

      if (!mounted.current) return;
      startCountdown(data.text ?? "", data.corrections ?? []);
    } catch (error) {
      if (!mounted.current) return;
      if ((error as Error).name === "AbortError") {
        setMessage("Transcription took too long. Try a shorter question, or upload the audio.");
      } else {
        setMessage((error as Error).message);
      }
      setPhaseSafe("problem");
    } finally {
      clearInterval(elapsedTimer);
      clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function startCountdown(text: string, foundCorrections: Correction[] = []) {
    resetHeard();
    setHeard(text);
    setCorrections(foundCorrections);
    setPhaseSafe("heard");

    if (autoSendMs === null) return;

    let remaining = Math.ceil(autoSendMs / 1000);
    setCountdown(remaining);
    countdownTimer.current = setInterval(() => {
      remaining -= 1;
      if (!mounted.current) return;
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        onSend(text);
        resetHeard();
        setPhaseSafe("idle");
      }
    }, 1000);
  }

  function sendNow() {
    const text = heard;
    resetHeard();
    setPhaseSafe("idle");
    onSend(text);
  }

  function cancelSend() {
    resetHeard();
    setPhaseSafe("idle");
  }

  function editHeard() {
    const text = heard;
    resetHeard();
    setPhaseSafe("idle");
    onEdit(text);
  }

  async function start() {
    if (disabled || starting.current || phaseRef.current === "recording") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser cannot record audio. Use the Upload audio option.");
      setPhaseSafe("problem");
      return;
    }

    wantRecording.current = true;
    starting.current = true;
    setMessage("");

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });

      // The user let go while the permission prompt was open.
      if (!wantRecording.current || !mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }

      stream.current = media;
      chunks.current = [];
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (timer.current) clearInterval(timer.current);
        if (maxTimer.current) clearTimeout(maxTimer.current);
        recorder.current = null;
        stream.current = null;
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 100) {
          setMessage("I did not hear anything. Hold the button and speak, then let go.");
          setPhaseSafe("problem");
          return;
        }
        void transcribe(blob);
      };
      rec.start();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      maxTimer.current = setTimeout(stop, MAX_RECORDING_MS);
      setPhaseSafe("recording");
    } catch {
      wantRecording.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setMessage("The microphone is not available. Allow it in the browser, or upload an audio file.");
      setPhaseSafe("problem");
    } finally {
      starting.current = false;
    }
  }

  function stop() {
    wantRecording.current = false;
    if (maxTimer.current) clearTimeout(maxTimer.current);
    maxTimer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
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
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            void start();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault();
              void start();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              stop();
            }
          }}
          className={`${base} ${
            phase === "recording" ? "border-bad bg-bad text-white" : "border-line-strong bg-surface hover:bg-sunk"
          } disabled:opacity-45`}
        >
          <Icon name="mic" size={large ? 56 : 22} />
          {phase === "recording"
            ? `Listening… ${seconds}s (15s maximum)`
            : large
              ? "Hold to talk, release to ask"
              : "Hold to talk"}
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
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void transcribe(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {phase === "transcribing" ? (
        <p className="text-sm font-medium text-soft" role="status">
          Listening to the recording… {elapsed}s
          <span className="block text-xs">
            The on-device speech model can take 10–30 seconds on this machine.
            {warming ? " Preparing the speech model…" : ""}
          </span>
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
          {corrections.length > 0 ? (
            <span className="text-xs text-soft" data-testid="voice-corrections">
              Corrected {corrections.map((correction) => `“${correction.from}” → “${correction.to}”`).join(", ")}
            </span>
          ) : null}
          {autoSendMs !== null ? (
            <span className="text-sm text-soft">Sending in {countdown} seconds</span>
          ) : null}
          <button
            type="button"
            onClick={sendNow}
            className="min-h-11 rounded-control border border-line-strong bg-surface px-4 font-semibold hover:bg-sunk"
          >
            Send
          </button>
          <button
            type="button"
            onClick={editHeard}
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
