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
| 17 | Inventory health dashboard | Must (scope change) | 05 |
| 18 | Shift handover | Must (scope change) | 15 |
| 19 | Dispatch verification | Must (scope change) | 11 |
| 20 | Eval script and measured results | Must | 08, 11, 13, 14 |
| 21 | Submission pack: README, disclosures, demo script, final run-through | Must | 16, 20, 22-27 |
| 22 | Accounts, sign-in and roles (seeded login per persona) | Must (scope change) | 01 |
| 23 | Landing page and sign-in page | Must (scope change) | 22 |
| 24 | Role-aware navigation and home dashboards | Must (scope change) | 22 |
| 25 | Inventory Controller workspace | Must (scope change) | 22, 12 |
| 26 | Logistics Manager workspace | Must (scope change) | 22, 19 |
| 27 | Per-role end-to-end verification (all personas, all features) | Must (scope change) | 22-26 |

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

**Scope change (2026-10-24, user request):** every feature must work for every persona (Operator, Supervisor, Inventory Controller, Logistics Manager), with a landing page and a sign-in page offering a seeded login for each user. Tickets 17, 18 and 19 are therefore required, and tickets 22 to 27 are added. The earlier "no login, operator and shift selector" decision (grill-me A9, ticket 05) is replaced by real sessions (see decision D-004). If time runs out, the work is cut in this order: polish on 26, then 25, then everything else stays.

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

- [x] A script runs each candidate on the fixtures and records memory and latency.
- [x] Chosen model per role, with the reason, in the spec's model table.
- [x] Licences recorded for every chosen model.
- [x] Total resident memory with the chosen models fits the 8 GB machine with headroom.
- [x] Candidates that fail the bar are listed with why.

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

- [x] Stock and location questions return correct database figures even if the fake model's prose contains different numbers (test).
- [x] Ambiguous match returns candidates and does not guess (test).
- [x] Unknown product returns a not-found message (test).
- [x] The model has no tool that can write (test).
- [x] Follow-up question resolves from the previous product (test).
- [x] Streaming, record card and stop button work in the browser with the real model.

---

# 07: Ask: below-minimum, receiving schedule, PO lookup

**What to build:** The operator can ask "What stock is below minimum levels?", "Show today's receiving schedule" and "What is on PO 4471?" and gets streamed answers with cards listing the exact records. All figures come from the database.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Below-minimum returns exactly the seeded products at or below minimum (test).
- [x] Receiving schedule returns the POs due on the requested date, defaulting to today (test).
- [x] PO lookup returns header and lines, and not-found for an unknown PO (test).
- [x] Cards show the records behind each answer.

---

# 08: Knowledge copilot: SOP search with citations and refusal

**What to build:** The operator asks "What should I do with damaged inventory?" and gets an answer drawn from the SOP documents, citing the document and section (for example the quarantine area and form WH-QA-04). When nothing relevant exists, the answer is the fixed "I don't have an SOP for that" message. Safety questions (chemical storage, forklift checklist, PPE per zone) work the same way. SOPs are chunked and ingested into QVAC's RAG workspace by a repeatable ingest step.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Ingest step builds the SOP index from the Markdown files and can be re-run.
- [x] A relevant question returns an answer with at least one citation (document and section).
- [x] An out-of-scope question returns the fixed refusal, not a model guess (test with fake retrieval).
- [x] Safety questions return safety-document citations.
- [x] Answers stream, and the stop button works.

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

- [x] Discrepancy covers short, over, exact, missing-line and unexpected-line cases (tests).
- [x] Nothing changes stock until the clerk confirms (test).
- [x] Confirmation updates stock, last-moved, event and exception (test).
- [x] The 150 versus 142 demo case produces "missing 8".
- [x] UI shows the report with status colours.

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

- [x] Variance is correct for negative, positive and zero cases (tests).
- [x] Confirming a count with variance raises an exception and does not change stock (test).
- [x] Adjust stock changes stock and writes an event (test).
- [x] The 35 versus 31 demo case works end to end.

---

# 13: Count: propose a count from a shelf photo

**What to build:** After choosing the location, the operator takes a photo with on-screen guidance. The photo is resized, and the vision model proposes a count. The operator confirms or edits it, then the existing variance flow runs. The photo is stored with the count. If the model cannot estimate, the operator is told and can count manually.

**Blocked by:** 04, 12

**Status:** ready-for-agent

- [x] A shelf photo produces a proposed integer, or "unable to estimate".
- [x] The proposal never becomes a record without confirmation (test).
- [x] The photo is stored and linked to the count.
- [x] Manual count remains available at every step.
- [x] Accuracy on the shelf fixtures is measured and recorded.

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

- [x] Receipts with discrepancy and counts with variance appear automatically (test).
- [x] Equipment issues appear in the same list.
- [x] Filters by type and shift work.
- [x] Each row links back to the underlying record.

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

- [x] Each rule is correct at and either side of its threshold (tests).
- [x] Seeded data produces at least one finding per category.
- [x] Recommendations are fixed templates, and the model cannot alter numbers.

---

# 18: Shift handover (nice-to-have, cut 1st)

**What to build:** The supervisor selects a shift window and generates a handover. The app aggregates events in that window into structured data (deliveries received, orders dispatched, discrepancies, variances, equipment issues), the model writes the prose, and the structured numbers are shown beside it.

**Blocked by:** 15

**Status:** ready-for-agent

- [x] Only events inside the shift window are included (test).
- [x] Structured numbers are displayed beside the prose.
- [x] The summary works with the network off.

---

# 19: Dispatch verification (nice-to-have, cut 3rd)

**What to build:** A dispatch clerk picks a sales order and enters loaded quantities by typing, by voice or by a photo of the loading sheet. The system compares loaded against ordered per line, alerts to shortfalls (ordered 50 pallets, loaded 48, missing 2), and on confirmation records the dispatch, updates stock and writes an event.

**Blocked by:** 11

**Status:** ready-for-agent

- [x] Shortfall, exact and over-loaded cases are correct (tests, reusing the discrepancy behaviour).
- [x] The 50 versus 48 demo case produces "missing 2".
- [x] Nothing changes until the clerk confirms (test).
- [x] The loading-sheet photo path works through the shared document-reading capability.

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

---

# 22: Accounts, sign-in and roles (seeded login per persona)

**What to build:** Real local accounts. Each of the four personas (Operator, Supervisor, Inventory Controller, Logistics Manager) has a seeded user with a username and password. A user signs in, gets a signed session cookie, and every API request is checked against that session and the user's role. Actions are attributed to the signed-in user (not to a value the browser sends). The shift is chosen at sign-in (defaulting to the current one) and can be changed later. Passwords are stored hashed. Sign-out ends the session. No external services are used.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Seeded users exist for all four roles, each able to sign in with their documented demo password (test).
- [x] Wrong passwords and unknown users are rejected with the same message (test).
- [x] Session tokens cannot be forged, altered or reused after expiry (tests).
- [x] Every API route that reads or changes warehouse data rejects a request with no valid session (401).
- [x] The role permissions matrix is enforced on the server (tests for each capability and role).
- [x] The actor on every event, receipt, count and exception is the signed-in user.

---

# 23: Landing page and sign-in page

**What to build:** A public landing page that explains the product to a judge or warehouse manager in one screen, then shows what each persona gets, how the offline guarantee works, and a clear way to sign in. A sign-in page shows the seeded demo logins for the four users, with one-tap fill, so a judge can try every role in seconds. Designed with the installed design skills. No external requests, Poppins bundled.

**Blocked by:** 22

**Status:** ready-for-agent

- [x] `/` shows the landing page to everyone, with a sign-in call to action (and "Open the app" when already signed in).
- [x] `/signin` lists the four demo logins and signs in with either typed or one-tap credentials.
- [x] Wrong credentials show a plain error message and keep the user on the page.
- [x] Neither page requests any external origin.
- [x] Both pages are usable on a phone-sized screen and with keyboard only.

---

# 24: Role-aware navigation and home dashboards

**What to build:** After sign-in each user lands on a home screen made for their job, and sees only the destinations their role can use. Operator: today's deliveries, orders to load, quick actions. Supervisor: open exceptions, products below minimum, shift handover. Inventory Controller: counts waiting for reconciliation, dead and slow stock. Logistics Manager: open orders, dispatch accuracy, shortfalls. All numbers come from the records.

**Blocked by:** 22

**Status:** ready-for-agent

- [x] Each role's home shows figures computed from the database (tests for each figure).
- [x] Navigation shows only destinations the role may use, and direct links to others show a clear "not available for your role" page.
- [x] Switching user changes the home screen and the navigation.

---

# 25: Inventory Controller workspace

**What to build:** The Inventory Controller can search stock records by product, location or category, see each record's recent movements, start cycle counts, and reconcile counts that show a variance by approving or declining the stock adjustment. They also see the inventory health findings that matter for accuracy.

**Blocked by:** 22, 12

**Status:** ready-for-agent

- [x] Stock records can be searched and show movement history for each product.
- [x] A count with variance appears in a reconciliation list, and approving it adjusts stock and writes an event (declining records the decision and leaves stock unchanged).
- [x] Only roles with the capability can approve (tests).
- [x] The cycle-count flow from ticket 12 is available to this role.

---

# 26: Logistics Manager workspace

**What to build:** The Logistics Manager sees shipment visibility (open and dispatched orders with status), dispatch accuracy (share of dispatches loaded in full, shortfalls by order and customer) and process compliance (receipts and dispatches with discrepancies, how many are resolved), and can verify a dispatch and generate a shift handover.

**Blocked by:** 22, 19

**Status:** ready-for-agent

- [x] Shipment list shows each order's status and loaded versus ordered quantities.
- [x] Dispatch accuracy and shortfalls are computed from the dispatch records (tests).
- [x] Process compliance figures are computed from receipts and dispatches (tests).
- [x] Dispatch verification and shift handover are available to this role.

---

# 27: Per-role end-to-end verification

**What to build:** Browser tests that sign in as each of the four seeded users and walk the features that role owns, plus checks that features outside a role are blocked. This is the proof that "all features work for all users".

**Blocked by:** 22, 23, 24, 25, 26

**Status:** ready-for-agent

- [x] Operator: sign in, ask, receive, count, voice, dispatch verification.
- [x] Supervisor: exceptions, health, handover, adjust stock.
- [x] Inventory Controller: stock records, reconcile a count.
- [x] Logistics Manager: shipments, dispatch accuracy, handover.
- [x] A user cannot reach another role's API or screen.

---

# 28: Per-persona sidebars, testing guide, offline and phone testing

**What to build:** (user feedback, 2026-10-26) Each persona's sidebar reflects the features the brief lists for that persona, so no two look alike. A guide and tools show how to test every backend function for every role, and how to test offline on the laptop and on a phone.

**Blocked by:** 22, 24

**Status:** ready-for-agent

- [x] Each sidebar is grouped by that persona's three needs from the brief, and no two personas share a sidebar (unit and browser tests).
- [x] Missing persona features added: Safety, Hands-free, Count plan, Reconciliation, Stock approvals, Operations feed, Dispatch accuracy, Compliance.
- [x] `npm run smoke:api` checks every endpoint as every persona (allowed and refused) and each role's workflows, with `--ai` for the AI features.
- [x] `docs/05-testing-guide.md` gives a manual checklist per persona and API examples.
- [x] `docs/06-offline-and-devices.md` explains laptop offline use, phone over a local hotspot (HTTPS for camera and mic), WSL networking, and why no APK is needed.
- [ ] `npm run offline:check` passes with no network.
