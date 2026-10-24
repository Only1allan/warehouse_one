import {
  completion,
  LLAMA_3_2_1B_INST_Q4_0,
  loadModel,
  unloadModel,
} from "@qvac/sdk";

const started = Date.now();
const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  onProgress: (p: { percentage: number }) => {
    process.stderr.write(`\rdownload/load ${p.percentage.toFixed(0)}%   `);
  },
});
console.error(`\nloaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);

const t0 = Date.now();
let first = 0;
const run = completion({
  modelId,
  history: [{ role: "user", content: "Say hello to a warehouse operator in one short sentence." }],
  stream: true,
});
for await (const token of run.tokenStream) {
  if (!first) first = Date.now() - t0;
  process.stdout.write(token);
}
console.error(`\nfirst token ${first}ms, total ${Date.now() - t0}ms`);
console.error(`rss ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);
await unloadModel({ modelId });
process.exit(0);
