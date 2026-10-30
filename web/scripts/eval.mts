/**
 * Measures the AI features with the real QVAC models on this machine, using the same code the
 * app runs (QvacModelPort and the services). Writes eval-results/RESULTS.md and results.json.
 * Run with the network off to show it needs none: npm run eval
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { QvacModelPort } from "../lib/ai/qvac/qvac-model-port";
import { MODELS } from "../lib/ai/qvac/models";
import { openDatabase } from "../lib/db";
import { seedDatabase } from "../lib/db/seed";
import { askCopilot, SOP_MIN_SCORE } from "../lib/services/ask";
import { readDocument } from "../lib/services/document-reading";

const root = process.cwd();
const fixtures = path.join(root, "data", "fixtures");
const outDir = path.join(root, "eval-results");
fs.mkdirSync(outDir, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, "manifest.json"), "utf8"));
const port = new QvacModelPort();
const now = new Date();
const db = openDatabase(":memory:");
seedDatabase(db, now);

let peakMB = 0;
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
  const mb = Math.round(total / 1024);
  peakMB = Math.max(peakMB, mb);
  return mb;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const log = (s: string) => console.log(s);

const results: Record<string, unknown> = {
  machine: { cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGB: r1(os.totalmem() / 1e9), platform: `${os.platform()} ${os.release()}` },
  models: MODELS,
  date: now.toISOString(),
};

// 1. Tool routing through the real ask pipeline
log("\n1. Routing questions to the right lookup");
type AskCase = {
  question: string;
  expectedTool: string;
  argIncludes?: Record<string, string>;
};
const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "ask-cases.json"), "utf8")) as AskCase[];
let routedRight = 0;
let argsRight = 0;
let modelRight = 0;
const routeTimes: number[] = [];
const misses: string[] = [];
const argMisses: string[] = [];
for (const c of cases) {
  const t0 = Date.now();
  let tool: { name: string; arguments: Record<string, unknown>; routedBy: string } | null = null;
  for await (const event of askCopilot({ db, model: port, now: () => now }, { message: c.question })) {
    if (event.type === "tool") {
      tool = { name: event.name, arguments: event.arguments, routedBy: event.routedBy };
    }
    if (event.type === "card" || event.type === "done") break;
  }
  routeTimes.push(Date.now() - t0);
  const argsOk =
    !c.argIncludes ||
    Object.entries(c.argIncludes).every(([key, expected]) =>
      String(tool?.arguments[key] ?? "")
        .toLowerCase()
        .includes(expected.toLowerCase()),
    );
  if (tool?.name === c.expectedTool) {
    routedRight++;
    if (tool.routedBy === "model") modelRight++;
    if (argsOk) argsRight++;
    else argMisses.push(`${c.question} -> ${JSON.stringify(tool.arguments)}`);
  } else {
    misses.push(`${c.question} -> ${tool?.name ?? "none"} ${JSON.stringify(tool?.arguments ?? {})}`);
  }
  treeRssMB();
}
results.routing = {
  questions: cases.length,
  accuracyPct: r1((100 * routedRight) / cases.length),
  modelOnlyAccuracyPct: r1((100 * modelRight) / cases.length),
  argAccuracyPct: r1((100 * argsRight) / cases.length),
  firstQuestionMs: routeTimes[0],
  medianMsAfterFirst: [...routeTimes.slice(1)].sort((a, b) => a - b)[Math.floor((routeTimes.length - 1) / 2)],
  misses,
  argMisses,
};
log(JSON.stringify(results.routing));

// 2. SOP retrieval and refusal
log("\n2. Finding the right procedure, and refusing when there is none");
const inScope: Array<[string, string]> = [
  ["What should I do with damaged inventory?", "Damaged Goods"],
  ["How should chemicals be stored?", "Chemical Storage"],
  ["Forklift inspection checklist?", "Forklift"],
  ["What PPE is required in Zone C?", "Personal Protective Equipment"],
  ["How do I process returns?", "Returns"],
  ["What is the receiving process?", "Receiving"],
  ["How do I clean up a spill?", "Chemical Storage"],
  ["How much can one person lift?", "Manual Handling"],
  ["What do I do when the fire alarm goes off?", "Incident"],
  ["How do I count a shelf?", "Cycle Counting"],
  ["What must I check before the truck leaves?", "Dispatch"],
  ["How soon must an incident form be filed?", "Incident"],
];
const offTopic = [
  "How do I fly a helicopter?",
  "What is the capital of France?",
  "Write me a poem about the sea.",
  "How do I bake bread?",
  "Who won the football match yesterday?",
];
let top1 = 0;
let top3 = 0;
const inScores: number[] = [];
const retrieveTimes: number[] = [];
for (const [q, doc] of inScope) {
  const t0 = Date.now();
  const passages = await port.retrieveSop(q, 3);
  retrieveTimes.push(Date.now() - t0);
  if (passages[0]?.document.includes(doc)) top1++;
  if (passages.some((p) => p.document.includes(doc))) top3++;
  inScores.push(passages[0]?.score ?? 0);
}
const offScores: number[] = [];
for (const q of offTopic) offScores.push((await port.retrieveSop(q, 3))[0]?.score ?? 0);
treeRssMB();
results.sop = {
  questions: inScope.length,
  top1Pct: r1((100 * top1) / inScope.length),
  top3Pct: r1((100 * top3) / inScope.length),
  meanRetrieveMs: Math.round(mean(retrieveTimes)),
  threshold: SOP_MIN_SCORE,
  lowestInScopeScore: r1(Math.min(...inScores) * 100) / 100,
  highestOffTopicScore: r1(Math.max(...offScores) * 100) / 100,
  offTopicRefusedPct: r1((100 * offScores.filter((s) => s < SOP_MIN_SCORE).length) / offTopic.length),
  inScopeAnsweredPct: r1((100 * inScores.filter((s) => s >= SOP_MIN_SCORE).length) / inScope.length),
  inScores: inScores.map((s) => Math.round(s * 1000) / 1000),
  offScores: offScores.map((s) => Math.round(s * 1000) / 1000),
};
log(JSON.stringify(results.sop));

// 3. Speech to text
log("\n3. Speech to text");
const clips = manifest.audio as Array<{ file: string; transcript: string }>;
function wer(ref: string, hyp: string): number {
  const a = norm(ref).split(" ");
  const b = norm(hyp).split(" ");
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] / a.length;
}
const wers: number[] = [];
const speechTimes: number[] = [];
for (const clip of clips) {
  const t0 = Date.now();
  const { text } = await port.transcribe(new Uint8Array(fs.readFileSync(path.join(fixtures, clip.file))));
  speechTimes.push(Date.now() - t0);
  wers.push(wer(clip.transcript, text));
}
treeRssMB();
results.speech = {
  clips: clips.length,
  meanWerPct: r1(100 * mean(wers)),
  exactClips: wers.filter((w) => w === 0).length,
  meanSecondsPerClip: r1(mean(speechTimes) / 1000),
};
log(JSON.stringify(results.speech));

// 4. Reading delivery notes and loading sheets (OCR, then the language model, then checks)
log("\n4. Reading documents");
const notes = manifest.notes as Array<{ file: string; kind: "delivery_note" | "loading_sheet"; reference: string; lines: Array<{ sku: string; quantity: number }> }>;
let refRight = 0;
let linesRight = 0;
let linesTotal = 0;
const docTimes: number[] = [];
for (const note of notes) {
  const t0 = Date.now();
  const doc = await readDocument({ db, model: port }, new Uint8Array(fs.readFileSync(path.join(fixtures, note.file))), note.kind);
  docTimes.push(Date.now() - t0);
  const matched = note.kind === "delivery_note" ? doc.matchedPoNumber : doc.matchedOrderNumber;
  if (matched === note.reference) refRight++;
  for (const truth of note.lines) {
    linesTotal++;
    if (doc.lines.some((l) => l.sku === truth.sku && l.noteQty === truth.quantity)) linesRight++;
  }
  log(`  ${note.file}: matched ${matched}, ${doc.lines.length} lines, ${Math.round((Date.now() - t0) / 1000)} s`);
  treeRssMB();
}
results.documents = {
  documents: notes.length,
  orderMatchedPct: r1((100 * refRight) / notes.length),
  linesCorrectPct: r1((100 * linesRight) / linesTotal),
  meanSecondsPerDocument: r1(mean(docTimes) / 1000),
};
log(JSON.stringify(results.documents));

// 5. Proposing a count from a shelf photo
log("\n5. Proposing a count from a shelf photo (512 px, as the app sends it)");
const shelves = manifest.shelves as Array<{ file: string; count: number }>;
const errors: number[] = [];
const countTimes: number[] = [];
let unparsed = 0;
for (const shelf of shelves) {
  const t0 = Date.now();
  const proposal = await port.proposeCount(new Uint8Array(fs.readFileSync(path.join(fixtures, shelf.file.replace("images/", "images/small/")))), {
    sku: "x",
    productName: "carton",
  });
  countTimes.push(Date.now() - t0);
  if (proposal.count === null) unparsed++;
  else errors.push(Math.abs(proposal.count - shelf.count));
}
treeRssMB();
results.counting = {
  photos: shelves.length,
  exactPct: r1((100 * errors.filter((e) => e === 0).length) / shelves.length),
  within1Pct: r1((100 * errors.filter((e) => e <= 1).length) / shelves.length),
  meanAbsError: r1(mean(errors)),
  noNumber: unparsed,
  meanSecondsPerPhoto: r1(mean(countTimes) / 1000),
};
log(JSON.stringify(results.counting));

results.peakMemoryMB = peakMB;
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2) + "\n");

const R = results as Record<string, Record<string, unknown>>;
const md = `# Evaluation results

Measured by \`npm run eval\` on ${now.toISOString().slice(0, 10)} with the real QVAC models, on this machine:
${(results.machine as { cpu: string }).cpu}, ${(results.machine as { cores: number }).cores} cores, ${(results.machine as { memoryGB: number }).memoryGB} GB memory, CPU only (no GPU).

These are measurements on the synthetic fixtures in \`data/fixtures\`, not product claims.

| Feature | Model | Result | Speed |
|---|---|---|---|
| Routing a question to the right lookup | ${MODELS.llm.constant} | ${R.routing.accuracyPct}% of ${R.routing.questions} questions (${R.routing.modelOnlyAccuracyPct}% by the model alone, the rest by the rule-based fallback); arguments right ${R.routing.argAccuracyPct}% | first question ${Math.round(Number(R.routing.firstQuestionMs) / 1000)} s, then about ${r1(Number(R.routing.medianMsAfterFirst) / 1000)} s (attention cache) |
| Finding the right procedure | ${MODELS.embeddings.constant} | top result right ${R.sop.top1Pct}%, right one in the top 3 ${R.sop.top3Pct}% | ${R.sop.meanRetrieveMs} ms |
| Refusing questions with no procedure | same | ${R.sop.offTopicRefusedPct}% of off-topic questions refused, ${R.sop.inScopeAnsweredPct}% of real ones answered (threshold ${R.sop.threshold}) | |
| Speech to text | ${MODELS.speech.constant} | ${R.speech.meanWerPct}% word error rate, ${R.speech.exactClips} of ${R.speech.clips} clips exact | ${R.speech.meanSecondsPerClip} s per clip |
| Reading a delivery note or loading sheet | ${MODELS.ocr.constant} + ${MODELS.llm.constant} | order matched ${R.documents.orderMatchedPct}%, lines exactly right ${R.documents.linesCorrectPct}% | ${R.documents.meanSecondsPerDocument} s per document |
| Proposing a shelf count | ${MODELS.vision.constant} | exact ${R.counting.exactPct}%, within 1 ${R.counting.within1Pct}%, mean error ${R.counting.meanAbsError} | ${R.counting.meanSecondsPerPhoto} s per photo |

Peak memory of the app's AI process tree during the run: **${peakMB} MB**.

Routing questions it got wrong: ${(R.routing.misses as string[]).length ? (R.routing.misses as string[]).join("; ") : "none"}.

Questions routed to the right tool with wrong arguments: ${(R.routing.argMisses as string[]).length ? (R.routing.argMisses as string[]).join("; ") : "none"}.

Notes: photo counting is approximate, so the app always shows the count as a proposal for the operator to check, and the variance is worked out from the number the operator confirms. Stock numbers never come from a model.
`;
fs.writeFileSync(path.join(outDir, "RESULTS.md"), md);
log(`\nWrote eval-results/RESULTS.md (peak memory ${peakMB} MB)`);
process.exit(0);
