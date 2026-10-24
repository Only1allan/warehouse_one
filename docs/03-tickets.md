# 03 - Tickets: Warehouse Operations Copilot

Status: **Approved to execute** (user instructed: write tickets, then implement until done)
Date: 2026-10-24
Inputs: `01-grill-me.md`, `02-spec.md`
Label for GitHub publishing: `ready-for-agent` (publish once a repo exists)

Each ticket is a vertical slice: it cuts through schema, logic, API, UI and tests, and is demoable or verifiable on its own. "Blocked by" lists only the tickets that genuinely gate it. Tickets are numbered in dependency order.

Test approach for every ticket: behaviour tested at the application-service seam with a real in-memory `node:sqlite` database and a fake ModelPort (see spec, Testing Decisions). Deterministic logic is built test-first.

## Overview

| # | Title | Tier | Blocked by |
|---|---|---|---|
| 01 | Foundation: data, seed, events, test runner | Must | None |
| 02 | Spike: QVAC inside Next.js, ModelPort and fallback decision | Must | None |
| 03 | Demo fixtures: SOPs, delivery notes, shelf images, audio | Must | 01 |
| 04 | Model selection: measure candidates and freeze the model table | Must | 02, 03 |
| 05 | App shell, design system, operator and shift selector, local badge | Must | 01 |
| 06 | Ask: inventory lookup end to end | Must | 04, 05 |
| 07 | Ask: below-minimum, receiving schedule, PO lookup | Must | 06 |
| 08 | Knowledge copilot: SOP search with citations and refusal | Must | 06 |
| 09 | Readiness page, Prepare offline, model lifecycle | Must | 08 |
| 10 | Receiving: compare and confirm (manual entry) | Must | 01, 05 |
| 11 | Receiving: read a delivery note from a photo | Must | 04, 10 |
| 12 | Count: manual count, variance, exception, adjust | Must | 01, 05 |
| 13 | Count: propose a count from a shelf photo | Must | 04, 12 |
| 14 | Voice: push-to-talk questions | Must | 04, 08 |
| 15 | Supervisor: exceptions view | Must | 10, 12 |
| 16 | Offline checkpoint (Wed 28) | Must | 07, 08, 09, 11 |
| 17 | Inventory health dashboard | Nice (cut 2nd) | 05 |
| 18 | Shift handover | Nice (cut 1st) | 15 |
| 19 | Dispatch verification | Nice (cut 3rd) | 11 |
| 20 | Eval script and measured results | Must | 08, 11, 13, 14 |
| 21 | Submission pack: README, disclosures, demo script, final run-through | Must | 16, 20 |

### Dependency graph

```
01 ──┬── 03 ──┐
     ├── 05 ──┼───────────────┐
     │        │               │
02 ──┴────────┴── 04 ──┬── 06 ┴── 07
                       │    └── 08 ── 09
                       │          └── 14 (also 04)
                       ├── 11 (also 10)
                       └── 13 (also 12)
01,05 ── 10 ── 11 ──┬── 19
01,05 ── 12 ── 13   │
10,12 ── 15 ── 18   │
05 ── 17            │
07,08,09,11 ── 16 ──┴── 21 (also 20)
08,11,13,14 ── 20 ──┘
```

### Execution order (frontier first)

1. 01 and 02 start immediately and in parallel.
2. 03, 05, then 04.
3. 06, 10, 12, then 07, 08, 11, 13.
4. 09, 14, 15, then 16 (Wed 28 checkpoint).
5. 17, 19, 18 as time allows (reverse of the cut order).
6. 20, then 21.

Cut order if behind: 18 (handover), then 17 (health), then 19 (dispatch). All other tickets are must-haves.

---

# 01: Foundation: data, seed, events, test runner

**What to build:** A runnable project foundation. A developer can reset the demo database to a known state with one command and run the test suite. The database holds the full warehouse domain (products, locations, stock, POs and lines, receipts, sales orders and lines, counts, events, equipment issues, synonyms, operators and shifts). The seed contains about 40 SKUs, about 30 locations, 5 POs, 6 sales orders and 90 days of movement history, including the named demo cases (150 expected and 142 received, 50 pallets ordered and 48 loaded, 35 expected and 31 counted) and at least one example per health category. Every confirmed write produces an audit event through one shared mechanism. The solution folder is a git repository with the MIT licence and sensible ignores.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] One command resets the database to seed state, and running it twice gives identical data.
- [x] The test runner executes, and a test of the reseed behaviour passes against an in-memory database built from the real schema.
- [x] Seed includes each named demo case and at least one dead, slow-moving, stockout-risk and overstock product.
- [x] Recording an event stores type, operator, shift, timestamp and structured payload, and is covered by a test.
- [x] Git repository initialised, MIT licence present, model caches and databases ignored.

---

# 02: Spike: QVAC inside Next.js, ModelPort and fallback decision

**What to build:** Prove that QVAC can run in-process inside the Next.js server with the native addons, and define the one AI interface the app will use. A browser page can send a prompt and see a real locally-run model stream a reply token by token, with a working stop button, with the network disconnected after the model is cached. The ModelPort interface exists with the capabilities listed in the spec, plus a deterministic fake for tests. A single shared model manager keeps loaded models across hot reloads. The outcome records a go or no-go on in-process, and if no-go, the same ModelPort is served by a separate local Node process.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A real local LLM streams a completion into the browser through the Next.js server.
- [x] Works with the network off once models are cached (verified and recorded).
- [x] Hot reload does not reload the model.
- [x] Cancelling a generation stops it.
- [x] ModelPort interface and fake exist, and a test exercises the fake.
- [x] Decision recorded: in-process or fallback service, with the reason. If fallback, it is working.
- [x] Next.js docs in the project were read before writing server code, and any configuration needed for native packages is in place.

---

# 03: Demo fixtures: SOPs, delivery notes, shelf images, audio

**What to build:** All the content the demo and the evaluation need. Markdown SOP and safety documents covering damaged goods and form WH-QA-04, returns, receiving, chemical storage, forklift inspection and PPE per zone. Synthetic delivery-note images matching the seeded POs (including the 150 versus 142 case), a loading sheet for the 50-pallet case, shelf images for count tests, and short spoken-question audio clips. A manifest records the true values for every fixture so evaluation can score against them. Real photos supplied by the user can be dropped in beside the synthetic ones.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] At least 8 SOP and safety documents with clear section headings.
- [x] Delivery-note images for at least 4 seeded POs, with a manifest of true fields.
- [x] A loading-sheet image for the 50-pallet order.
- [x] Shelf images with known counts, with the manifest of true counts.
- [x] At least 10 short audio clips with known transcripts.
- [x] A list of about 20 question-to-expected-tool cases for tool-selection evaluation.
- [x] Instructions say where the user can add real photos.

---

# 04: Model selection: measure candidates and freeze the model table

**What to build:** A repeatable measurement of every candidate model on this machine, and a frozen choice for each role. The result is the filled model table in the spec: LLM, embeddings, vision, OCR and speech, each with measured memory, latency, quality on the fixtures and licence. If no candidate meets the bar for a role, the table says so and the affected feature's fallback behaviour is recorded.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] A script runs each candidate on the fixtures and records memory and latency.
- [ ] Chosen model per role, with the reason, in the spec's model table.
- [ ] Licences recorded for every chosen model.
- [ ] Total resident memory with the chosen models fits the 8 GB machine with headroom.
- [ ] Candidates that fail the bar are listed with why.

---

# 05: App shell, design system, operator and shift selector, local badge

**What to build:** The usable frame of the product. The operator opens the app, picks their name and shift, and lands in a tablet-friendly layout with navigation to Ask, Receive, Count and Supervisor. A persistent "100% local" badge is visible on every screen. The visual direction is industrial and utilitarian (high-contrast light theme, safety-yellow accent, very large type and touch targets, distinct status colours), designed with the `frontend-design` skill. The app makes no external network requests (fonts and assets are bundled).

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Operator and shift selection persists across navigation and attributes later events.
- [x] The four navigation destinations exist and are reachable with large touch targets.
- [x] The "100% local" badge is visible on every screen.
- [x] No page requests any external origin.
- [x] Design tokens for status colours (OK, warning, discrepancy) are defined and used.

---

# 06: Ask: inventory lookup end to end

**What to build:** The operator types "How many generators do we have?" or "Where is SKU 001254 stored?" and gets a streamed answer, with a card showing the underlying product, location, quantity and last movement. The model picks the read-only tool and its arguments, matching is deterministic (full-text search plus synonyms), and the number in the answer always comes from the database. Ambiguous wording returns a candidate list to choose from, and unknown products say so. Follow-ups such as "where is it?" use the last resolved product. There is a stop button, and the last four messages are kept for context.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Stock and location questions return correct database figures even if the fake model's prose contains different numbers (test).
- [ ] Ambiguous match returns candidates and does not guess (test).
- [ ] Unknown product returns a not-found message (test).
- [ ] The model has no tool that can write (test).
- [ ] Follow-up question resolves from the previous product (test).
- [ ] Streaming, record card and stop button work in the browser with the real model.

---

# 07: Ask: below-minimum, receiving schedule, PO lookup

**What to build:** The operator can ask "What stock is below minimum levels?", "Show today's receiving schedule" and "What is on PO 4471?" and gets streamed answers with cards listing the exact records. All figures come from the database.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Below-minimum returns exactly the seeded products at or below minimum (test).
- [ ] Receiving schedule returns the POs due on the requested date, defaulting to today (test).
- [ ] PO lookup returns header and lines, and not-found for an unknown PO (test).
- [ ] Cards show the records behind each answer.

---

# 08: Knowledge copilot: SOP search with citations and refusal

**What to build:** The operator asks "What should I do with damaged inventory?" and gets an answer drawn from the SOP documents, citing the document and section (for example the quarantine area and form WH-QA-04). When nothing relevant exists, the answer is the fixed "I don't have an SOP for that" message. Safety questions (chemical storage, forklift checklist, PPE per zone) work the same way. SOPs are chunked and ingested into QVAC's RAG workspace by a repeatable ingest step.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Ingest step builds the SOP index from the Markdown files and can be re-run.
- [ ] A relevant question returns an answer with at least one citation (document and section).
- [ ] An out-of-scope question returns the fixed refusal, not a model guess (test with fake retrieval).
- [ ] Safety questions return safety-document citations.
- [ ] Answers stream, and the stop button works.

---

# 09: Readiness page, Prepare offline, model lifecycle

**What to build:** A readiness page lists every required model as missing, downloading, cached or loaded, with sizes. "Prepare offline" downloads everything and ingests the SOPs, with live progress and clear errors. At start, the LLM and embeddings model warm up and the app shows when it is ready. Speech, OCR and vision load on first use and unload after about 5 minutes idle. A first run with the network on followed by a run with the network off works end to end.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Readiness reflects the true state of each model.
- [ ] Prepare offline downloads missing models and shows progress.
- [ ] After Prepare offline, the app works with the network disabled.
- [ ] Idle models unload, and resident memory is measured and recorded.
- [ ] Missing-model errors are plain and say what to do.

---

# 10: Receiving: compare and confirm (manual entry)

**What to build:** A receiving clerk opens Receive, chooses a PO, enters what was actually received per line, and sees a discrepancy report (for example expected 150, received 142, missing 8, plus missing and unexpected lines). On explicit confirmation the receipt is saved, stock is added at each product's default location, the last-moved date updates, an audit event is written, and any discrepancy becomes an exception. This is the AI-free core that photo reading will feed into.

**Blocked by:** 01, 05

**Status:** ready-for-agent

- [ ] Discrepancy covers short, over, exact, missing-line and unexpected-line cases (tests).
- [ ] Nothing changes stock until the clerk confirms (test).
- [ ] Confirmation updates stock, last-moved, event and exception (test).
- [ ] The 150 versus 142 demo case produces "missing 8".
- [ ] UI shows the report with status colours.

---

# 11: Receiving: read a delivery note from a photo

**What to build:** The clerk photographs a delivery note. OCR reads it, the LLM turns the text into structured fields (PO number, supplier, lines of SKU, description, quantity), and the PO is matched in the database. An editable table shows the extracted lines with low-confidence fields highlighted. The clerk corrects anything, and the flow continues into the existing compare and confirm. If the PO cannot be read, the clerk picks it manually.

**Blocked by:** 04, 10

**Status:** ready-for-agent

- [ ] The seeded delivery-note fixtures extract to the expected fields at the measured accuracy (recorded).
- [ ] Extraction output is validated and bad model output does not crash the flow (test with fake).
- [ ] The clerk can edit every extracted field before comparing.
- [ ] Manual PO selection works when the PO is unreadable.
- [ ] The end-to-end photo to confirmed receipt works with the network off.

---

# 12: Count: manual count, variance, exception, adjust

**What to build:** The operator chooses a location or SKU, enters the counted quantity, and sees variance against expected stock (for example expected 35, counted 31, variance minus 4). Confirming the count records it and raises an exception when variance is not zero. Stock changes only when someone explicitly chooses "Adjust stock" on that count, which writes an event.

**Blocked by:** 01, 05

**Status:** ready-for-agent

- [ ] Variance is correct for negative, positive and zero cases (tests).
- [ ] Confirming a count with variance raises an exception and does not change stock (test).
- [ ] Adjust stock changes stock and writes an event (test).
- [ ] The 35 versus 31 demo case works end to end.

---

# 13: Count: propose a count from a shelf photo

**What to build:** After choosing the location, the operator takes a photo with on-screen guidance. The photo is resized, and the vision model proposes a count. The operator confirms or edits it, then the existing variance flow runs. The photo is stored with the count. If the model cannot estimate, the operator is told and can count manually.

**Blocked by:** 04, 12

**Status:** ready-for-agent

- [ ] A shelf photo produces a proposed integer, or "unable to estimate".
- [ ] The proposal never becomes a record without confirmation (test).
- [ ] The photo is stored and linked to the count.
- [ ] Manual count remains available at every step.
- [ ] Accuracy on the shelf fixtures is measured and recorded.

---

# 14: Voice: push-to-talk questions

**What to build:** The operator holds a button and speaks. Audio is recorded and converted to 16 kHz mono WAV in the browser, transcribed locally, and shown as "I heard: ...". After about 2 seconds the question is sent into the normal Ask pipeline unless edited or cancelled. Blank and hallucinated transcripts are filtered with a clear message. If live microphone capture does not work in this environment, uploading an audio file is the fallback.

**Blocked by:** 04, 08

**Status:** ready-for-agent

- [ ] A spoken question gets the same kind of answer as the typed one.
- [ ] "I heard" is shown with edit and cancel during the send window.
- [ ] Filtered transcripts are not sent as questions (test).
- [ ] Audio clips from the fixtures transcribe at the measured accuracy (recorded).
- [ ] Microphone result in the WSL and Windows browser setup is recorded, with the upload fallback working.

---

# 15: Supervisor: exceptions view

**What to build:** The supervisor opens one list of exceptions: receiving discrepancies, count variances, dispatch shortfalls and equipment issues. Each shows the source, the numbers, who recorded it and when. Items can be filtered by type and shift.

**Blocked by:** 10, 12

**Status:** ready-for-agent

- [ ] Receipts with discrepancy and counts with variance appear automatically (test).
- [ ] Equipment issues appear in the same list.
- [ ] Filters by type and shift work.
- [ ] Each row links back to the underlying record.

---

# 16: Offline checkpoint (Wed 28)

**What to build:** A verified, repeatable offline run of everything built so far (Ask, Inventory, Knowledge, Receiving). The app is started and used with the network disconnected. Every external request is audited and removed. The manual offline checklist is written and executed, and any failure becomes a fix in this ticket.

**Blocked by:** 07, 08, 09, 11

**Status:** ready-for-agent

- [ ] With the network disabled, Ask, Inventory, Knowledge and Receiving all work end to end.
- [ ] An audit shows no external request from any page.
- [ ] The manual offline checklist exists and was executed, with results recorded.
- [ ] Known gaps are listed with owners and fixes.

---

# 17: Inventory health dashboard (nice-to-have, cut 2nd)

**What to build:** A supervisor view that lists dead stock, slow-moving stock, stockout risk and overstock, each with its numbers and a templated recommendation (for example "Product P-324 has not moved in 90 days. Consider promotion or transfer."). Thresholds are configurable constants.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Each rule is correct at and either side of its threshold (tests).
- [ ] Seeded data produces at least one finding per category.
- [ ] Recommendations are fixed templates, and the model cannot alter numbers.

---

# 18: Shift handover (nice-to-have, cut 1st)

**What to build:** The supervisor selects a shift window and generates a handover. The app aggregates events in that window into structured data (deliveries received, orders dispatched, discrepancies, variances, equipment issues), the model writes the prose, and the structured numbers are shown beside it.

**Blocked by:** 15

**Status:** ready-for-agent

- [ ] Only events inside the shift window are included (test).
- [ ] Structured numbers are displayed beside the prose.
- [ ] The summary works with the network off.

---

# 19: Dispatch verification (nice-to-have, cut 3rd)

**What to build:** A dispatch clerk picks a sales order and enters loaded quantities by typing, by voice or by a photo of the loading sheet. The system compares loaded against ordered per line, alerts to shortfalls (ordered 50 pallets, loaded 48, missing 2), and on confirmation records the dispatch, updates stock and writes an event.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Shortfall, exact and over-loaded cases are correct (tests, reusing the discrepancy behaviour).
- [ ] The 50 versus 48 demo case produces "missing 2".
- [ ] Nothing changes until the clerk confirms (test).
- [ ] The loading-sheet photo path works through the shared document-reading capability.

---

# 20: Eval script and measured results

**What to build:** A script that runs the real QVAC adapter against the fixtures, with the network off, and prints measured results: tool-selection accuracy on about 20 questions, delivery-note field accuracy, count accuracy, transcription accuracy, latency and memory. The results are written to a file the README includes. It measures and reports. It does not gate.

**Blocked by:** 08, 11, 13, 14

**Status:** ready-for-agent

- [ ] One command produces the full results report.
- [ ] The script runs with the network disabled.
- [ ] Results are reproducible within normal variation on this machine.
- [ ] Results are recorded and compared with the provisional targets in the spec.

---

# 21: Submission pack: README, disclosures, demo script, final run-through

**What to build:** Everything the judges need. A README with the problem, the user, the track, setup and run instructions from a clean machine, the Prepare offline step, the QVAC integration (SDK version 0.22.0 at time of writing, model names, download steps, the files where QVAC is used), device and OS and memory needs, model licences, measured results, what needs a network (the initial model download only), what was built during the event, and credit for all reused work. A demo-video script following the agreed order. A final run-through of the demo with the network off, plus a clean-checkout setup test.

**Blocked by:** 16, 20

**Status:** ready-for-agent

- [ ] README contains every item the hackathon requires.
- [ ] A clean checkout follows the README and reaches a working offline demo.
- [ ] The demo script is written, and a full offline rehearsal passes.
- [ ] No secrets, private data or large model files are in the repository.
- [ ] Submission links (repo, video) are accessible, with a checklist ready for the noon Friday submission.
