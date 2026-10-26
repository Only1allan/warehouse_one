# 04 - Decision Log

Running record of decisions made during implementation, with the evidence behind them. Newest last.

## D-001 (ticket 02): QVAC runs in-process inside Next.js. No fallback service needed.

Date: 2026-10-24
Status: **Decided (go)**

**Evidence** (CPU-only WSL2, Ubuntu 26.04, Node 24.22, 8 GB class machine, `@qvac/sdk` 0.22.0, Llama 3.2 1B Instruct Q4_0):

| Check | Result |
|---|---|
| Plain Node script: load model and stream a reply | Works. First token about 650 ms and full short reply about 1.6 s, once loaded. |
| Same model through a Next.js 16 route handler (dev server) | Works. Native addons load in-process with the SDK marked as an external server package. |
| First request (includes model load) | About 13 s. |
| Warm requests | About 0.75 to 1.0 s for a short reply. Generation about 7.5 tokens per second on CPU. |
| Hot reload (edit a source file, then the route file) | The loaded model survives. Next requests stay at about 0.8 s, so no reload. |
| Cancellation (client aborts a long generation after 2 s) | Generation stops, and the next request returns in about 0.8 s, so the model is not left busy. |
| Network disabled (isolated network namespace, no network at all) | Model loads from cache and generates normally (smoke script). |
| Browser (Playwright, Chromium): stream a reply, press Stop | Both pass. |

**Configuration that made it work**
- `serverExternalPackages` includes `@qvac/sdk` and `@qvac/inference`.
- The model manager and the model port are held on `globalThis`, so dev hot reload does not create a second instance.
- AI endpoints are POST route handlers. With `cacheComponents` enabled, GET handlers that read the database must opt in to request-time rendering.
- Next.js telemetry is disabled for development so no external request is made.

**Consequences**
- The separate Node AI service fallback from the spec is not built. The ModelPort boundary remains, so it can still be added later.
- Throughput of about 7.5 tokens per second means streaming and a Stop button are essential, and answers must be kept short.

## D-002 (ticket 01): Schema is a TypeScript string module, not `.sql` files

Date: 2026-10-24
Status: Decided

The spec said "plain SQL files". Reading `.sql` files at runtime depends on the working directory and does not survive bundling. The schema is therefore a string constant in a TypeScript module. It is still plain SQL and reviewable in one place.

## D-003: Repository setup

Date: 2026-10-24
Status: Decided

- The solution folder is the git root and pushes to `git@github.com:Only1allan/warehouse_one.git` (the repo was empty, so there is no pre-existing code to disclose).
- The scaffold's own nested git repository in the web folder (one create-next-app commit) was backed up outside the project and removed, so the solution folder can be a single repository.
- Design skills used for UI work: `frontend-design`, `design-taste-frontend`, `impeccable` (telemetry off, no hooks installed) and `apple-design`.
- Tests: Vitest for logic, Playwright (Chromium) for browser flows.
- Typeface: Poppins, bundled locally (no external font requests).

## D-004: Scope change, real accounts and all features for all personas

Date: 2026-10-24
Status: Decided (user request)

The user asked for: (1) every feature implemented for every user, and (2) a landing page and a sign-in page with a seeded login for each user.

**What changes**
- The earlier decision of "no authentication, operator and shift selector" (grill-me A9) is replaced by local accounts with hashed passwords and signed session cookies. Actions are attributed to the signed-in user.
- The four personas from the source brief (Operator, Supervisor, Inventory Controller, Logistics Manager) each get a seeded user and a role-aware experience. Previously Inventory Controller and Logistics Manager were served by the same screens.
- Dispatch verification, inventory health and shift handover are no longer nice-to-haves. They are required.
- New tickets: 22 to 27 (see 03-tickets.md).

**What does not change**
- All AI is local through QVAC. The language model never writes data and never invents a number.
- Authentication is local to the device: no identity provider, no network. Demo credentials are shown on the sign-in page on purpose so judges can try every role. They are demo values for seeded data only, and the page says so.

**Risks**
- Schedule: this adds substantial work to a 6-day plan. Mitigation: build the auth layer first, because everything else depends on it, then deliver role by role.
- A visible-credentials sign-in page is only appropriate for a demo. The README states how to remove it (set the demo accounts switch off).

## D-005: Each persona gets its own sidebar, built from the brief's needs

Date: 2026-10-26
Status: Decided (user feedback: "the sidebar for each operator is the same")

Before this change the supervisor could reach every screen, so the personas looked alike. Now each persona's sidebar is grouped under the three needs the brief lists for it, and capabilities were narrowed to match:

| Persona | Groups (from the brief) | Screens |
|---|---|---|
| Operator | Quick access to information · Voice interaction · Inventory verification | My shift, Ask the copilot, Safety, Hands-free, Receive delivery, Count a shelf, Check a load |
| Supervisor | Operational visibility · Exception reporting · Inventory alerts | Operations overview (live feed), Shift handover, Exceptions, Inventory alerts, Stock approvals, Ask |
| Inventory Controller | Accurate stock records · Faster cycle counts · Reconciliation support | Accuracy overview, Stock records, Count plan, Cycle count, Reconciliation, Ask |
| Logistics Manager | Dispatch accuracy · Shipment visibility · Process compliance | Logistics overview, Dispatch accuracy, Check a load, Shipments, Compliance, Shift handover, Ask |

New features added to fill the gaps: Safety (F8), Hands-free voice screen (F5), Count plan (a ranked, reasoned list of what to count next), separate Reconciliation and Stock approvals screens, a Supervisor operations feed, and separate Dispatch accuracy and Compliance screens. The server enforces the same matrix (`lib/auth/capabilities.ts`), and both a unit test and a browser test check that no two personas share a sidebar.

## D-006: Final model choices (measured on the target machine)

Date: 2026-10-26
Status: Decided

All numbers were measured by `scripts/measure-models.mts` on the fixtures, CPU only.

**Language model (tool routing).** Measured with tool support on (`modelConfig.tools: true`), grammar-constrained `tool_choice: "required"` and the KV cache.

| Candidate | Right tool | Right arguments | Per question | Memory |
|---|---|---|---|---|
| **Llama 3.2 1B Instruct Q4_0 (chosen)** | **87.5%** | **100%** | **2.2 s** | 1.9 GB |
| Qwen3 1.7B Instruct Q4 (thinking off) | 87.5% | 100% | 6.1 s | 2.6 GB |
| Llama "tool calling" 1B Q4_K_M | could not run: its chat template does not render tool definitions | | | 1.7 GB |

Llama 3.2 1B and Qwen3 1.7B are equally accurate, and Llama is nearly three times faster with less memory. The rule-based fallback catches some of the misses (for example "How do I process returns?").

An earlier run reported 0% for every model. That was my harness bug: tools were not enabled at load time. Llama also writes its call as plain JSON with "parameters" instead of "arguments", which the SDK does not parse. `lib/copilot/tool-recovery.ts` reads it back, accepting only known tool names.

**Embeddings.** EmbeddingGemma 300M Q4_0: 91.7% top-1, 100% top-3, 28 ms per query. GTE Large: 100% top-1 but 155 ms per query and slower to index. Chosen: EmbeddingGemma, because answers use the top 3 passages.

**Speech.** Parakeet TDT 0.6B v3 Q8: 4.2% word error rate, 0.48 s per clip, 1.3 GB. Whisper tiny: 9.6%, 0.74 s. Whisper base: 11.3%, 1.25 s. Chosen: Parakeet. It loads on demand, so the extra memory is only used during voice.

**OCR.** OCR Latin. With the default 1.5× magnification and three rotation retries: 91.9% of key fields, 48.8 s per image, 3.4 GB. With magnification 1.0 and no rotation retries: **100% of key fields, 97.2% of words, 18.6 s, 1.8 GB**. Chosen: the second.

**Vision (count proposal).**

| Candidate | Image | Exact | Within 1 | Mean error | Per photo |
|---|---|---|---|---|---|
| VisionPsy Nano 460M | 1024 px | 33% | 33% | 9.3 | 79.5 s |
| SmolVLM2 500M | 1024 px | 17% | 50% | 4.3 | 17.4 s |
| **SmolVLM2 500M (chosen)** | **512 px** | 17% | 33% | **3.8** | **6.6 s** |
| Qwen3.5 0.8B and 2B | 1024 px | 0% | 0% | 20 (always answered 1) | 22 to 64 s |

No small vision model counts reliably on CPU. This confirms the agreed design: the model proposes a number and the operator confirms it. Photos are resized to 512 px in the browser before counting, and to 1280 px for documents.

## D-007: KV cache for routing

Date: 2026-10-26
Status: Decided

Tool definitions make the routing prompt about 900 tokens. On CPU that took 17 to 27 s before the first token, on every question. With a fixed `kvCache` key the shared prefix is reused: the first token arrives in about 0.4 s and routing takes about 2.2 s. To keep the prefix stable, the follow-up hint ("the product being discussed is ...") moved from the system prompt to the user turn. Warm-up runs one routing request at start, so even the first question is fast.

## D-008: Offline testing and phones

Date: 2026-10-26
Status: Decided

The AI runs in the Next.js server on the laptop, so no APK is needed. Ways to test:
1. Laptop alone with Wi-Fi off (the demo).
2. Phone as a screen, camera and microphone over a local hotspot with mobile data off. `npm run phone` serves HTTPS with a locally made certificate, because browsers only allow the microphone on secure pages.
3. `npm run offline:check`, which runs the app in a network namespace with no network and runs every backend and AI check against it.

A native Android app (Expo and QVAC on the phone) is possible but would be a rewrite, and is out of scope. See `06-offline-and-devices.md`.
