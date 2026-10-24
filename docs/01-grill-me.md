# 01 - Grill-Me Outcome: Warehouse Operations Copilot

Status: **Agreed** (user confirmed shared understanding)
Date: 2026-10-24
Next step: `02-spec.md` (via the `to-spec` skill), then `03-tickets.md` (via `to-tickets`)

This document records what we decided during the grilling session, why, and what is still an open risk. It is the input to the spec.

## 1. Context

| Item | Value |
|---|---|
| Project | Warehouse Operations Copilot |
| Source brief | `Warehouse Operations Copilot.docx` (user's Windows Documents folder). Referenced, not copied. |
| Hackathon | AI Yako: Own Your AI (QVAC Hackathon), DoraHacks, hosted with Node NBO, Nairobi |
| Track | **Offline AI apps** (700 USDt, also eligible for the 1,500 USDt overall prize) |
| Build window | Sat 24 Oct to Fri 30 Oct 2026 |
| Submission deadline | **Fri 30 Oct, 17:00 EAT** (internal target: **noon**) |
| Offline check | Wed 28 Oct |
| Demo day | Sat 31 Oct, Node NBO |
| Repo root | `solution_1/` (`docs/`, `web/`, `README.md`) |
| App | `solution_1/web/` (Next.js 16.4.3, React 19.3, Tailwind 4, TypeScript) |

### Hackathon rules that constrain us

- The core AI feature must run with the internet off. A cloud AI API for that feature makes the project ineligible for prizes.
- Judging: real user value, meaningful QVAC integration, working implementation, usability, clarity and reproducibility of the offline demo.
- Required submission: public repo with setup instructions and a note on what was built during the event, a demo video recorded offline, QVAC integration details (SDK/package versions, model names, download/setup steps, files where QVAC is used), device/OS/memory needs, model licences, a list of anything that still needs a network, and credit for all reused work.
- No private data, passwords, API keys or wallet secrets in the submission.

## 2. Facts established during the session

| Area | Fact |
|---|---|
| QVAC SDK | `@qvac/sdk` v0.22.0, Apache-2.0, Node >= 22.17. Drives a Bare worker, so it needs a server-side runtime. It cannot run in the browser. |
| Native addons | The SDK depends on many native addons (llama.cpp, OCR, ASR, embeddings, etc.), so Next.js must treat it as an external server package (`serverExternalPackages`). |
| Model download | Models download on first load and are then cached. "Offline" therefore means offline after a one-time download. |
| Tool calling | `completion()` supports tool calls with a grammar-constrained sampler. |
| Vision | Multimodal models exist (VisionPsy Nano 460M, SmolVLM2, Qwen-VL), each needing a matching projection model. |
| OCR | Two-stage ONNX pipeline (CRAFT text detector plus a language recognizer, e.g. `OCR_LATIN`). |
| Transcription | Whisper (plus VAD) or Parakeet (about 750 MB). Whisper hallucinates text such as `[BLANK_AUDIO]` on silence. |
| Image classification | The bundled classifier only knows `food`, `report` and `other`. It cannot count items, so it is not used. |
| RAG | Built-in workspace functions (`ragIngest`, `ragSearch`). The docs describe the built-in store as prototype-grade. |
| Voice assistant pattern | Needs VAD tuning, mic gating during TTS and filtering of hallucinated transcripts. |
| Dev machine | WSL2, Ubuntu 26.04, Node v24.22.1, x86_64, **CPU-only** (no Vulkan tooling found), about 7 GB RAM (about 5 GB free), `libatomic` present, `g++` absent (probably not needed because of prebuilds). |
| Database | Node 24 ships `node:sqlite` (no native dependency). |
| Next.js | `web/AGENTS.md` warns that this Next.js version has breaking changes. Docs are in `web/node_modules/next/dist/docs/`. They must be read before writing Next.js code. `next.config.ts` already enables `cacheComponents`. |

## 3. Decisions

### 3.1 Product

| # | Decision | Rationale |
|---|---|---|
| P1 | Track: **Offline AI apps**. | The brief describes a new app, so Cloud to Pocket does not fit. WDK and finance are not used. |
| P2 | QVAC SDK is the **only AI layer**. No cloud AI and no cloud fallback. | Hard hackathon rule. |
| P3 | **Primary persona: Warehouse Operator.** Secondary: Supervisor. | Operator needs hands-free lookup, receiving and counting. Inventory Controller and Logistics Manager are served by the same screens. |
| P4 | Language: **English only**. Swahili is a documented stretch. | Scope control. QVAC translation exists if time allows. |
| P5 | Product goals from the brief (for example -30% receiving errors) are kept as **goals only**. The submission reports **only what we measure**. | Avoids unmeasured claims in front of judges. |

### 3.2 Scope

| Tier | Features |
|---|---|
| **Must have** | F1 Knowledge Copilot (SOP and Safety Q&A, with Safety folded in as another document set). F2 Inventory lookup. F3 Receiving verification. F5 Voice queries. F6 Image-assisted cycle count. |
| **Nice to have** (cut in this order if behind) | F9 Shift handover, then F7 Inventory health dashboard, then F4 Dispatch verification. |
| **Out of scope** | Phase 2 (forecasting, supplier risk, predictive maintenance). Image, video and music generation. Fine-tuning. P2P and Pears. WDK. Text-to-speech in the MVP. Login and auth. |

Image inventory (F6) was promoted from nice-to-have in the brief to must-have at the user's direction.

### 3.3 Trust and safety model

| # | Decision |
|---|---|
| T1 | The LLM **never generates a stock number, location or discrepancy**. It interprets requests (tool calls), extracts fields from documents and explains results. All quantities and comparisons come from the database and deterministic code. |
| T2 | The LLM has **read-only tools only**: `get_stock_level`, `find_location`, `list_below_minimum`, `get_receiving_schedule`, `get_po`, `search_sops`. |
| T3 | **Every write** (saving a receipt, count or dispatch) happens only through an explicit human confirmation in the UI. |
| T4 | SOP and safety answers **must cite** the source document and section. If no relevant passage is found, the copilot says "I don't have an SOP for that" and does not guess. |
| T5 | Ambiguous product matches **list candidates and ask the operator to choose**. |

### 3.4 Architecture

| # | Decision |
|---|---|
| A1 | QVAC runs **in-process inside the Next.js server** (Node runtime route handlers). All QVAC code is isolated in one server-only module (`web/lib/qvac/`). Models are held by a single shared manager so hot reload does not reload them. |
| A2 | The **first ticket is a spike** to prove QVAC works inside Next.js with the native addons. **Pre-agreed fallback**: a separate Node AI service with the same module boundary. |
| A3 | Database: **`node:sqlite`**. Schema in plain SQL files. A `seed` script resets to demo state. |
| A4 | RAG: **QVAC built-in workspace** over Markdown SOPs in `web/data/sop/*.md`, ingested at "Prepare offline" time. Prototype-grade store noted as a known limitation. |
| A5 | **Model choice is measured, not guessed.** The spike evaluates a shortlist on this machine. Bar: fits in about 3 GB RAM while loaded, does its job on our test set, has a licence we can disclose. Result goes into the spec as a table. |
| A6 | Model lifecycle: LLM and embeddings stay resident. Whisper, OCR and the vision model load on first use and unload after about 5 minutes idle. A **readiness page** shows every model as cached or missing, with a "Prepare offline" button and progress. All AI calls stream and have a stop button. |
| A7 | Fuzzy product matching is deterministic: SQLite full-text search plus a small synonyms table. The model only chooses the tool and arguments. |
| A8 | Conversation memory: each question plus the last 4 messages and the last resolved product or location. Chat history is not persisted. Confirmed actions go to the audit log. |
| A9 | No login. A seeded **operator / shift selector** attributes audit events. |

### 3.5 Feature flows

| Feature | Decision |
|---|---|
| **Voice (F5)** | Push-to-talk in the browser. Audio is recorded and converted to 16 kHz mono WAV in the browser, posted to a Next route and transcribed by QVAC. The UI shows "I heard: ..." and auto-sends after about 2 seconds unless the user edits or cancels. Blank or hallucinated transcripts are filtered. No TTS in the MVP. |
| **Receiving (F3)** | Photo of the delivery note goes through OCR, then the LLM turns the OCR text into structured fields (PO number, supplier, lines with SKU and quantity). The PO is matched in the database. The discrepancy is computed in code. The operator reviews and edits an extracted-lines table before anything is saved. |
| **Image count (F6)** | Operator picks the location or SKU first (tap or voice) so expected quantity is known. Photo is resized to about 1024 px. The vision model **proposes** a count and the operator **confirms or edits** it. Variance is computed in code. Photo is stored locally with the count record. Manual count is always available. Accuracy is measured on a test set and reported honestly. |
| **Dispatch (F4, nice)** | Reuses the receiving pipeline. Operator picks a sales order and enters loaded quantities by voice or by a photo of the loading sheet (OCR plus LLM extraction). Code compares loaded against ordered and raises the alert. |
| **Health monitor (F7, nice)** | Deterministic rules with configurable thresholds. Dead stock: no movement for 90 days or more. Slow-moving: 30 days or more. Stockout risk: quantity at or below minimum. Overstock: quantity at or above 3x reorder level. Recommendations are templated. The LLM only rephrases. |
| **Handover (F9, nice)** | Aggregates the event log for the shift window into structured data. The LLM writes the prose. The numbers are shown beside it so they can be checked. |

### 3.6 Data

| # | Decision |
|---|---|
| D1 | **Synthetic seeded data**: about 40 SKUs, 30 locations, 5 POs, 6 orders and 90 days of movement history. |
| D2 | Tables: `products`, `locations`, `stock`, `purchase_orders`, `po_lines`, `receipts`, `receipt_lines`, `sales_orders`, `order_lines`, `counts`, `events`, `equipment_issues`. |
| D3 | SOP and safety documents are written by us (for example form WH-QA-04, quarantine area, PPE per zone, forklift checklist). |
| D4 | Test images: synthetic delivery notes and shelf photos as a fallback, **plus a few real photos supplied by the user** for realism. |

### 3.7 UX

| # | Decision |
|---|---|
| U1 | One tablet-friendly app with big touch targets and high contrast. |
| U2 | Operator views: **Ask** (chat with an always-visible push-to-talk button), **Receive**, **Count**. A persistent "100% local" badge is always visible. |
| U3 | Supervisor view: exceptions, inventory health and handover. |
| U4 | Visual direction: industrial and utilitarian. High-contrast light theme for bright warehouses, safety-yellow accent, very large type, status colours for OK, warning and discrepancy. Details are chosen at implementation with the `frontend-design` skill. |

### 3.8 Offline, hardware and delivery

| # | Decision |
|---|---|
| O1 | **Offline bar**: after the one-time model download, every feature works with wifi off. No external requests at all (no CDN fonts, analytics or remote assets). A visible "100% local" indicator. A documented "Prepare offline" step. The demo video is recorded with the network disconnected. The only network need is the initial model download. |
| O2 | **Hardware target**: this machine is the demo-day device. Design for CPU-only with 8 GB RAM: small models, one heavy model at a time where needed, streaming output. |
| O3 | Testing: **Vitest with test-first development** (`tdd` skill) for deterministic logic (discrepancy, variance, health rules, tool routing). A small **offline eval script** measures tool-call accuracy (about 20 questions), OCR extraction accuracy on note images and count accuracy on shelf photos. Results go in the README. No browser e2e. A manual offline checklist covers the demo. |
| O4 | Repo: `solution_1/` is the git root, public on GitHub, **MIT** licence. README discloses the create-next-app scaffold and all third-party models and their licences. |
| O5 | Demo video (3 to 4 minutes, network visibly off throughout): wifi off, safety question with cited SOP answer, stock lookup by voice, delivery-note photo with discrepancy (150 expected, 142 received), shelf photo with count variance, readiness page, repo and README. Rehearsed on Wed 28. |
| O6 | Docs: `docs/01-grill-me.md`, `02-spec.md`, `03-tickets.md`. |

### 3.9 Schedule and cut order

| Day | Plan |
|---|---|
| Sat 24 to Sun 25 | Spike, project skeleton, Ask and Inventory lookup |
| Mon 26 | Knowledge base with citations |
| Tue 27 | Receiving |
| Wed 28 | **Offline check**: Ask, Inventory, Knowledge, Receiving |
| Thu 29 | Voice and Count |
| Fri 30 morning | Polish, README, demo video, **submit by noon** (5 hours of buffer) |

Cut order if behind: Handover, then Health dashboard, then Dispatch. The five must-haves are never cut.

## 4. Risks and assumptions

| Risk or assumption | Mitigation |
|---|---|
| QVAC native addons may not bundle cleanly in Next.js (Turbopack, `cacheComponents`). | Spike first. Pre-agreed fallback to a separate Node service. |
| Small CPU-only models may be slow or weak at tool calls, extraction and counting. | Measured model selection. Streaming UI. Human-in-the-loop for extraction and counts. Honest reporting of accuracy. |
| 8 GB RAM limits how many models can be loaded at once. | Lifecycle policy (A6). Measured memory budget in the spike. |
| Vision-model counting accuracy may be poor. | Propose-and-confirm flow, manual count fallback, constrained photo guidance. |
| QVAC built-in RAG store is prototype-grade. | Acceptable for the hackathon. Disclose in README. |
| Whisper hallucinations on silence. | Transcript filtering and visible "I heard" confirmation window. |
| Real photos are needed for realistic image tests. | User supplies a few. Synthetic images are the fallback. |
| Schedule is tight (6 days). | Fixed cut order and a noon Friday submission target. |
| WSL mic and browser access assumed to work via Windows `localhost` forwarding. | Verify early. Fall back to uploading an audio file if live capture fails. |

## 5. Open items carried into the spec

These were intentionally deferred to later steps. They are implementation details, not unresolved design questions.

- Final model table (LLM, embeddings, vision, OCR, ASR) with measured RAM and latency.
- Exact DB DDL, seed content and SOP document list.
- Tool JSON schemas and the system prompt.
- API route contracts.
- Eval set composition and pass thresholds.
- UI details and component inventory.
