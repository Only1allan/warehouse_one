import fs from "node:fs";
import path from "node:path";
import type { SopChunk, SopSourceDoc } from "../ai/model-port";

export const SOP_WORKSPACE = "warehouse-sops";

export function sopDirectory(): string {
  return process.env.SOP_DIR ?? path.join(process.cwd(), "data", "sop");
}

export function loadSopDocuments(dir: string = sopDirectory()): SopSourceDoc[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.md$/, ""),
      markdown: fs.readFileSync(path.join(dir, file), "utf8"),
    }));
}

/** Splits one SOP into one chunk per "## " section. The title is the first "# " line. */
export function chunkSop(doc: SopSourceDoc): SopChunk[] {
  const lines = doc.markdown.split("\n");
  const titleLine = lines.find((l) => l.startsWith("# "));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : doc.name;
  const chunks: SopChunk[] = [];
  let section: string | null = null;
  let body: string[] = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (section && text) chunks.push({ document: title, section, text });
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      section = line.replace(/^##\s+/, "").trim();
      body = [];
    } else if (section) {
      body.push(line);
    }
  }
  flush();
  return chunks;
}

const HEADER = /^\[(.+?) \| (.+?)\]\n/;

/** The text that is embedded: a header naming the source, then the section body. */
export function chunkToIndexText(chunk: SopChunk): string {
  return `[${chunk.document} | ${chunk.section}]\n${chunk.text}`;
}

export function indexTextToChunk(content: string): SopChunk | null {
  const match = content.match(HEADER);
  if (!match) return null;
  return { document: match[1], section: match[2], text: content.slice(match[0].length) };
}
