import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.join(process.cwd(), "data", "fixtures");
const imageDir = path.join(root, "images");
const audioDir = path.join(root, "audio");
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

interface NoteLine {
  sku: string;
  description: string;
  qty: number;
  unit: string;
}
interface Note {
  file: string;
  kind: "delivery_note" | "loading_sheet";
  reference: string;
  party: string;
  docNumber: string;
  date: string;
  lines: NoteLine[];
  style: "clean" | "photo" | "dotmatrix";
}

const notes: Note[] = [
  {
    file: "delivery-note-4471-clean.png", kind: "delivery_note", reference: "4471",
    party: "Kenya Packaging Ltd", docNumber: "DN-88213", date: "2026-10-28", style: "clean",
    lines: [
      { sku: "100201", description: "Corrugated Carton 40x30x30", qty: 150, unit: "carton" },
      { sku: "100305", description: "Stretch Wrap Roll", qty: 60, unit: "roll" },
      { sku: "100410", description: "Packing Tape 48mm", qty: 120, unit: "roll" },
    ],
  },
  {
    file: "delivery-note-4471-photo.png", kind: "delivery_note", reference: "4471",
    party: "Kenya Packaging Ltd", docNumber: "DN-88213", date: "2026-10-28", style: "photo",
    lines: [
      { sku: "100201", description: "Corrugated Carton 40x30x30", qty: 150, unit: "carton" },
      { sku: "100305", description: "Stretch Wrap Roll", qty: 60, unit: "roll" },
      { sku: "100410", description: "Packing Tape 48mm", qty: 120, unit: "roll" },
    ],
  },
  {
    file: "delivery-note-4472.png", kind: "delivery_note", reference: "4472",
    party: "SafeWorks East Africa", docNumber: "SW-20417", date: "2026-10-28", style: "dotmatrix",
    lines: [
      { sku: "300118", description: "Hi-Vis Safety Vest", qty: 80, unit: "unit" },
      { sku: "300125", description: "Safety Helmet", qty: 40, unit: "unit" },
    ],
  },
  {
    file: "delivery-note-4473.png", kind: "delivery_note", reference: "4473",
    party: "Nairobi Industrial Supplies", docNumber: "NIS-5530", date: "2026-10-29", style: "clean",
    lines: [
      { sku: "001254", description: "Portable Generator 5kW", qty: 10, unit: "unit" },
      { sku: "800120", description: "Angle Grinder 115mm", qty: 20, unit: "unit" },
    ],
  },
  {
    file: "delivery-note-4474.png", kind: "delivery_note", reference: "4474",
    party: "ChemSupply Ltd", docNumber: "CS-77102", date: "2026-10-30", style: "photo",
    lines: [
      { sku: "400210", description: "Industrial Cleaner 20L", qty: 24, unit: "drum" },
      { sku: "400215", description: "Degreaser 5L", qty: 36, unit: "can" },
    ],
  },
  {
    file: "loading-sheet-5521.png", kind: "loading_sheet", reference: "5521",
    party: "Mombasa Hardware Ltd", docNumber: "LS-5521", date: "2026-10-28", style: "clean",
    lines: [
      { sku: "600100", description: "Roofing Sheets (pallet of 100)", qty: 50, unit: "pallet" },
    ],
  },
];

function noteHtml(n: Note): string {
  const title = n.kind === "delivery_note" ? "DELIVERY NOTE" : "LOADING SHEET";
  const refLabel = n.kind === "delivery_note" ? "Your PO No." : "Order No.";
  const partyLabel = n.kind === "delivery_note" ? "Supplier" : "Customer";
  const mono = n.style === "dotmatrix";
  const font = mono ? "'DejaVu Sans Mono', monospace" : "'Ubuntu Sans', 'DejaVu Sans', Arial, sans-serif";
  const rows = n.lines
    .map(
      (l) =>
        `<tr><td>${l.sku}</td><td>${l.description}</td><td class="q">${l.qty}</td><td>${l.unit}</td></tr>`,
    )
    .join("");
  const photo = n.style === "photo";
  return `<!doctype html><html><body style="margin:0;background:${photo ? "#6b5b4a" : "#ffffff"};width:1024px;height:768px;display:flex;align-items:center;justify-content:center;overflow:hidden">
  <div style="width:${photo ? 800 : 960}px;background:#fdfcf7;color:#1a1a1a;font-family:${font};padding:36px 44px;box-sizing:border-box;${
    photo
      ? "transform:rotate(-2.2deg) skewX(-1.5deg);box-shadow:8px 14px 28px rgba(0,0,0,.45);filter:contrast(.92) brightness(.97) blur(.35px)"
      : ""
  }">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a1a;padding-bottom:12px">
      <div><div style="font-size:30px;font-weight:700">${n.party}</div><div style="font-size:14px;color:#444">P.O. Box 4412, Nairobi, Kenya</div></div>
      <div style="text-align:right"><div style="font-size:28px;font-weight:800;letter-spacing:2px">${title}</div><div style="font-size:15px">No. ${n.docNumber}</div><div style="font-size:15px">Date: ${n.date}</div></div>
    </div>
    <div style="display:flex;gap:40px;margin:18px 0;font-size:17px">
      <div><b>${refLabel}</b> ${n.reference}</div><div><b>${partyLabel}:</b> ${n.party}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:18px">
      <thead><tr style="background:#e8e6dc;text-align:left"><th style="padding:8px">Item code</th><th>Description</th><th class="q">Qty</th><th>Unit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:36px;display:flex;justify-content:space-between;font-size:14px;color:#333">
      <div>Received by: ______________________</div><div>Signature: ______________________</div>
    </div>
  </div>
  <style>td,th{padding:8px;border-bottom:1px solid #bbb}.q{text-align:right}</style></body></html>`;
}

function shelfHtml(count: number, seed: number): string {
  const perRow = 10;
  let rows = "";
  let remaining = count;
  const rowCount = Math.ceil(count / perRow);
  for (let r = 0; r < rowCount; r++) {
    const inRow = Math.min(perRow, remaining);
    remaining -= inRow;
    let boxes = "";
    for (let i = 0; i < inRow; i++) {
      const tone = 150 + ((seed * 7 + r * 13 + i * 11) % 28);
      boxes += `<div style="width:84px;height:84px;background:rgb(${tone},${tone - 38},${tone - 82});border:2px solid #5b3d1e;margin-right:6px;position:relative;box-sizing:border-box">
        <div style="position:absolute;left:0;right:0;top:36px;height:10px;background:rgba(230,215,180,.7)"></div>
        <div style="position:absolute;left:8px;top:8px;width:30px;height:18px;background:#fff;font:9px sans-serif;color:#111;text-align:center">SKU</div></div>`;
    }
    rows += `<div style="display:flex;align-items:flex-end;height:96px;border-bottom:10px solid #2d3b57;padding:0 18px;background:linear-gradient(#e9e5dc,#d9d3c4)">${boxes}</div>`;
  }
  return `<!doctype html><html><body style="margin:0;width:1024px;height:768px;background:#8c8f93;display:flex;align-items:center;justify-content:center">
    <div style="width:980px;background:#c8c2b3;padding:12px 0;box-shadow:inset 0 0 40px rgba(0,0,0,.3)">${rows}</div></body></html>`;
}

const shelves = [6, 12, 18, 24, 31, 35];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const manifest: Record<string, unknown> = { notes: [], shelves: [], audio: [] };

for (const n of notes) {
  await page.setContent(noteHtml(n));
  await page.screenshot({ path: path.join(imageDir, n.file) });
  (manifest.notes as unknown[]).push({
    file: `images/${n.file}`, kind: n.kind, reference: n.reference, party: n.party,
    lines: n.lines.map((l) => ({ sku: l.sku, description: l.description, quantity: l.qty })),
  });
}
for (const [index, count] of shelves.entries()) {
  const file = `shelf-${String(count).padStart(2, "0")}.png`;
  await page.setContent(shelfHtml(count, index + 1));
  await page.screenshot({ path: path.join(imageDir, file) });
  (manifest.shelves as unknown[]).push({ file: `images/${file}`, count, synthetic: true });
}
await browser.close();

const utterances = [
  "How many generators do we have?",
  "Where are the generators stored?",
  "What stock is below minimum levels?",
  "Show today's receiving schedule.",
  "What should I do with damaged inventory?",
  "What PPE is required in Zone C?",
  "How do I process returns?",
  "How should chemicals be stored?",
  "Where can I find the safety helmets?",
  "What is on purchase order four four seven one?",
  "How many cartons are in stock?",
  "Give me the forklift inspection checklist.",
];

function wav16kMono(samples: number[], sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, s)), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

if (process.env.SKIP_AUDIO !== "1") {
  const { loadModel, textToSpeech, unloadModel, TTS_EN_SUPERTONIC_Q8_0 } = await import("@qvac/sdk");
  const modelId = await loadModel({
    modelSrc: TTS_EN_SUPERTONIC_Q8_0,
    modelType: "tts",
    modelConfig: { ttsEngine: "supertonic", language: "en", voice: "F1", outputSampleRate: 16000 },
  });
  for (const [index, text] of utterances.entries()) {
    const run = textToSpeech({ modelId, text, inputType: "text", stream: false });
    const samples = (await run.buffer) as number[];
    const rate = (await run.sampleRate) ?? 16000;
    const file = `question-${String(index + 1).padStart(2, "0")}.wav`;
    fs.writeFileSync(path.join(audioDir, file), wav16kMono(samples, rate));
    (manifest.audio as unknown[]).push({ file: `audio/${file}`, transcript: text, sampleRate: rate });
    console.log(`audio ${file} (${rate} Hz, ${samples.length} samples)`);
  }
  await unloadModel({ modelId });
}

fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("fixtures written to", root);
process.exit(0);
