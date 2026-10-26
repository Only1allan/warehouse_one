import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as sdk from "@qvac/sdk";
import { COPILOT_TOOLS } from "../lib/copilot/tools";
import { routingSystemPrompt } from "../lib/copilot/prompt";
import { recoverToolCall } from "../lib/copilot/tool-recovery";

const root = process.cwd();
const fixtures = path.join(root, "data", "fixtures");
const outDir = path.join(root, "eval-results");
fs.mkdirSync(outDir, { recursive: true });
const NOW = new Date(2026, 9, 28, 10, 0, 0);

const S = sdk as unknown as Record<string, any>;
const constant = (name: string) => {
  if (!(name in S)) throw new Error(`Unknown model constant ${name}`);
  return S[name];
};

function treeRssMB(): number {
  const rows = execSync("ps -eo pid=,ppid=,rss=").toString().trim().split("\n");
  const kids = new Map<number, number[]>();
  const rss = new Map<number, number>();
  for (const row of rows) {
    const [pid, ppid, kb] = row.trim().split(/\s+/).map(Number);
    rss.set(pid, kb);
    kids.set(ppid, [...(kids.get(ppid) ?? []), pid]);
  }
  let total = 0;
  const stack = [process.pid];
  while (stack.length) {
    const pid = stack.pop()!;
    total += rss.get(pid) ?? 0;
    stack.push(...(kids.get(pid) ?? []));
  }
  return Math.round(total / 1024);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

interface Result {
  role: string;
  candidate: string;
  ok: boolean;
  error?: string;
  baselineMB?: number;
  loadedMB?: number;
  deltaMB?: number;
  loadSeconds?: number;
  metrics?: Record<string, number | string>;
}
const results: Result[] = [];

async function measure(
  role: string,
  candidate: string,
  load: () => Promise<string>,
  run: (modelId: string) => Promise<Record<string, number | string>>,
) {
  const entry: Result = { role, candidate, ok: false };
  console.log(`\n=== ${role}: ${candidate}`);
  try {
    const warm = await load();
    await sdk.unloadModel({ modelId: warm });
    await new Promise((r) => setTimeout(r, 1500));
    entry.baselineMB = treeRssMB();
    const t0 = Date.now();
    const modelId = await load();
    entry.loadSeconds = round((Date.now() - t0) / 1000);
    entry.loadedMB = treeRssMB();
    entry.deltaMB = entry.loadedMB - entry.baselineMB;
    entry.metrics = await run(modelId);
    entry.loadedMB = Math.max(entry.loadedMB, treeRssMB());
    entry.deltaMB = entry.loadedMB - entry.baselineMB;
    await sdk.unloadModel({ modelId });
    entry.ok = true;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
    console.log("FAILED:", entry.error);
  }
  console.log(JSON.stringify(entry));
  results.push(entry);
  const file = path.join(outDir, `models-${role}.json`);
  const previous: Result[] = process.env.APPEND && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  fs.writeFileSync(file, JSON.stringify([...previous, ...results.filter((r) => r.role === role)], null, 2));
}

async function llm(names: string[]) {
  const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "ask-cases.json"), "utf8")) as Array<{
    question: string;
    expectedTool: string;
    argIncludes?: Record<string, string>;
  }>;
  const tools = COPILOT_TOOLS.map((t) => ({ type: "function" as const, ...t }));
  for (const name of names) {
    await measure("llm", name, () => sdk.loadModel({ modelSrc: constant(name), modelType: "llm", modelConfig: { ctx_size: 4096, tools: true } } as any) as Promise<string>, async (modelId) => {
      let correct = 0;
      let argsOk = 0;
      let argsTotal = 0;
      const latencies: number[] = [];
      const firsts: number[] = [];
      const tps: number[] = [];
      const misses: string[] = [];
      for (const c of cases) {
        const t0 = Date.now();
        const run = sdk.completion({
          modelId,
          history: [
            { role: "system", content: routingSystemPrompt(NOW) },
            { role: "user", content: c.question },
          ],
          stream: true,
          tools,
          kvCache: "measure-router",
          generationParams: { tool_choice: process.env.TC ?? "required", predict: 200, temp: 0, ...(name.startsWith("QWEN3") ? { reasoning_budget: 0 } : {}) },
        } as any);
        let call: { name: string; arguments: Record<string, unknown> } | null = null;
        let text = "";
        for await (const ev of run.events) {
          if (ev.type === "toolCall" && !call) call = { name: ev.call.name, arguments: ev.call.arguments };
          if (ev.type === "contentDelta") text += ev.text;
        }
        if (!call) call = recoverToolCall(text, COPILOT_TOOLS.map((t) => t.name));
        latencies.push((Date.now() - t0) / 1000);
        const stats = await run.stats;
        if (stats?.timeToFirstToken) firsts.push(stats.timeToFirstToken);
        if (stats?.tokensPerSecond) tps.push(stats.tokensPerSecond);
        const right = call?.name === c.expectedTool;
        if (right) correct++;
        else misses.push(`${c.question} -> ${call?.name ?? "none"}`);
        if (right && c.argIncludes) {
          for (const [key, needle] of Object.entries(c.argIncludes)) {
            argsTotal++;
            if (norm(String(call!.arguments[key] ?? "")).includes(norm(needle))) argsOk++;
          }
        }
      }
      return {
        toolAccuracyPct: round((100 * correct) / cases.length),
        argAccuracyPct: argsTotal ? round((100 * argsOk) / argsTotal) : 0,
        meanSecondsPerQuery: round(mean(latencies), 2),
        meanFirstTokenMs: round(mean(firsts), 0),
        tokensPerSecond: round(mean(tps), 1),
        misses: misses.slice(0, 6).join(" | "),
      };
    });
  }
}

async function embeddings(names: string[]) {
  const sopDir = path.join(root, "data", "sop");
  const chunks: Array<{ doc: string; text: string }> = [];
  for (const file of fs.readdirSync(sopDir).filter((f) => f.endsWith(".md"))) {
    const md = fs.readFileSync(path.join(sopDir, file), "utf8");
    const title = md.split("\n")[0].replace(/^#\s*/, "");
    for (const section of md.split(/\n(?=## )/).slice(1)) {
      chunks.push({ doc: file.replace(".md", ""), text: `${title}\n${section}` });
    }
  }
  const questions: Array<[string, string]> = [
    ["What should I do with damaged inventory?", "damaged-goods"],
    ["How should chemicals be stored?", "chemical-storage"],
    ["Forklift inspection checklist?", "forklift-inspection"],
    ["What PPE is required in Zone C?", "ppe-requirements"],
    ["How do I process returns?", "returns-processing"],
    ["What is the receiving process?", "receiving-procedure"],
    ["How do I clean up a spill?", "chemical-storage"],
    ["How much can one person lift?", "manual-handling"],
    ["What do I do when the fire alarm goes off?", "incident-reporting"],
    ["How do I count a shelf?", "cycle-counting"],
    ["What must I check before the truck leaves?", "dispatch-checks"],
    ["How soon must an incident form be filed?", "incident-reporting"],
  ];
  const unit = (v: number[]) => {
    const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map((x) => x / n);
  };
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  for (const name of names) {
    await measure("embeddings", name, () => sdk.loadModel({ modelSrc: constant(name), modelType: "embeddings" } as any) as Promise<string>, async (modelId) => {
      const t0 = Date.now();
      const { embedding } = (await sdk.embed({ modelId, text: chunks.map((c) => c.text) } as any)) as unknown as { embedding: number[][] };
      const corpusSeconds = (Date.now() - t0) / 1000;
      const docVecs = embedding.map(unit);
      let top1 = 0;
      let top3 = 0;
      const qLat: number[] = [];
      for (const [q, expected] of questions) {
        const q0 = Date.now();
        const { embedding: qe } = (await sdk.embed({ modelId, text: q } as any)) as unknown as { embedding: number[] };
        qLat.push(Date.now() - q0);
        const qv = unit(qe);
        const ranked = docVecs.map((v, i) => ({ i, s: dot(qv, v) })).sort((a, b) => b.s - a.s);
        if (chunks[ranked[0].i].doc === expected) top1++;
        if (ranked.slice(0, 3).some((r) => chunks[r.i].doc === expected)) top3++;
      }
      return {
        chunks: chunks.length,
        dimensions: docVecs[0].length,
        top1Pct: round((100 * top1) / questions.length),
        top3Pct: round((100 * top3) / questions.length),
        corpusEmbedSeconds: round(corpusSeconds, 2),
        meanQueryMs: round(mean(qLat), 0),
      };
    });
  }
}

function wer(ref: string, hyp: string): number {
  const r = norm(ref).split(" ");
  const h = norm(hyp).split(" ");
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}

async function asr(names: string[]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, "manifest.json"), "utf8"));
  const clips = manifest.audio as Array<{ file: string; transcript: string }>;
  for (const name of names) {
    const parakeet = name.startsWith("PARAKEET");
    await measure(
      "speech",
      name,
      () =>
        sdk.loadModel(
          parakeet
            ? ({ modelSrc: constant(name), modelType: "parakeet-transcription" } as any)
            : ({ modelSrc: constant(name), modelType: "whisper", modelConfig: { vadModelSrc: constant("VAD_SILERO_5_1_2") } } as any),
        ) as Promise<string>,
      async (modelId) => {
        const wers: number[] = [];
        const secs: number[] = [];
        const samples: string[] = [];
        for (const clip of clips) {
          const t0 = Date.now();
          const text = (await sdk.transcribe({ modelId, audioChunk: path.join(fixtures, clip.file) } as any)) as unknown as string;
          secs.push((Date.now() - t0) / 1000);
          wers.push(wer(clip.transcript, String(text)));
          if (samples.length < 3) samples.push(`${clip.transcript} => ${String(text).trim()}`);
        }
        return {
          meanWerPct: round(100 * mean(wers)),
          exactClips: wers.filter((w) => w === 0).length,
          clips: clips.length,
          meanSecondsPerClip: round(mean(secs), 2),
          samples: samples.join(" | "),
        };
      },
    );
  }
}

async function ocr(names: string[]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, "manifest.json"), "utf8"));
  const notes = manifest.notes as Array<{ file: string; reference: string; party: string; lines: Array<{ sku: string; description: string; quantity: number }> }>;
  for (const name of names) {
    const extra = process.env.OCR_CFG ? JSON.parse(process.env.OCR_CFG) : {};
    await measure(
      "ocr",
      process.env.OCR_CFG ? `${name} ${process.env.OCR_CFG}` : name,
      () =>
        sdk.loadModel({
          modelSrc: constant(name),
          modelConfig: { langList: ["en"], magRatio: 1.5, defaultRotationAngles: [90, 180, 270], contrastRetry: false, lowConfidenceThreshold: 0.5, recognizerBatchSize: 1, ...extra },
        } as any) as Promise<string>,
      async (modelId) => {
        const recalls: number[] = [];
        const numberRecalls: number[] = [];
        const secs: number[] = [];
        let sample = "";
        for (const note of notes) {
          const t0 = Date.now();
          const { blocks } = sdk.ocr({ modelId, image: path.join(fixtures, note.file), options: { paragraph: false } } as any);
          const result = (await blocks) as Array<{ text: string }>;
          secs.push((Date.now() - t0) / 1000);
          const text = norm(result.map((b) => b.text).join(" "));
          if (!sample) sample = text.slice(0, 200);
          const wanted = [note.reference, ...note.lines.flatMap((l) => [l.sku, String(l.quantity)])];
          const found = wanted.filter((w) => text.includes(norm(w)));
          numberRecalls.push(found.length / wanted.length);
          const words = [...norm(note.party).split(" "), ...note.lines.flatMap((l) => norm(l.description).split(" "))].filter((w) => w.length > 2);
          recalls.push(words.filter((w) => text.includes(w)).length / words.length);
        }
        return {
          keyFieldRecallPct: round(100 * mean(numberRecalls)),
          wordRecallPct: round(100 * mean(recalls)),
          meanSecondsPerImage: round(mean(secs), 2),
          sample,
        };
      },
    );
  }
}

async function vision(pairs: Array<[string, string]>) {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, "manifest.json"), "utf8"));
  const shelves = (manifest.shelves as Array<{ file: string; count: number }>).map((s) =>
    process.env.VISION_SMALL ? { ...s, file: s.file.replace("images/", "images/small/") } : s,
  );
  for (const [name, proj] of pairs) {
    await measure(
      "vision",
      process.env.VISION_SMALL ? `${name} (512px)` : name,
      () => sdk.loadModel({ modelSrc: constant(name), modelType: "llm", modelConfig: { ctx_size: 2048, projectionModelSrc: constant(proj) } } as any) as Promise<string>,
      async (modelId) => {
        let exact = 0;
        let within1 = 0;
        let unparsed = 0;
        const errs: number[] = [];
        const secs: number[] = [];
        const answers: string[] = [];
        for (const shelf of shelves) {
          const t0 = Date.now();
          const run = sdk.completion({
            modelId,
            history: [{ role: "user", content: "Count the brown cartons on the shelves in this photo. Reply with only the number.", attachments: [{ path: path.join(fixtures, shelf.file) }] }],
            stream: true,
            generationParams: { predict: 24, temp: 0 },
          } as any);
          let text = "";
          for await (const ev of run.events) if (ev.type === "contentDelta") text += ev.text;
          secs.push((Date.now() - t0) / 1000);
          const m = text.match(/\d+/);
          answers.push(`${shelf.count}:${m ? m[0] : "?"}`);
          if (!m) {
            unparsed++;
            continue;
          }
          const got = Number(m[0]);
          errs.push(Math.abs(got - shelf.count));
          if (got === shelf.count) exact++;
          if (Math.abs(got - shelf.count) <= 1) within1++;
        }
        return {
          exactPct: round((100 * exact) / shelves.length),
          within1Pct: round((100 * within1) / shelves.length),
          meanAbsError: round(mean(errs), 1),
          unparsed,
          meanSecondsPerImage: round(mean(secs), 2),
          trueVsAnswer: answers.join(" "),
        };
      },
    );
  }
}

const role = process.argv[2];
const names = process.argv.slice(3);
if (role === "llm") await llm(names);
else if (role === "embeddings") await embeddings(names);
else if (role === "speech") await asr(names);
else if (role === "ocr") await ocr(names);
else if (role === "vision") {
  await vision(names.map((n) => n.split("+") as [string, string]));
} else {
  console.error("usage: measure-models.mts <llm|embeddings|speech|ocr|vision> <MODEL...>");
  process.exit(1);
}
process.exit(0);
