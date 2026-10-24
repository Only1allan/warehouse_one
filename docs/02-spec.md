# 02 - Spec: Warehouse Operations Copilot

Status: **Draft for review**
Date: 2026-10-24
Inputs: `01-grill-me.md` (agreed decisions), `Warehouse Operations Copilot.docx` (source brief)
Next step: `03-tickets.md` (via `to-tickets`)
Triage label (when published to GitHub issues): `ready-for-agent`

## Problem Statement

Warehouse operators work with their hands full, in noisy and sometimes poorly connected buildings. To do their job they need answers that live in places that are slow to reach: SOP binders and safety guides, ERP screens, spreadsheets, paper delivery notes and their own memory. The result is predictable: receiving counts are wrong, the wrong items get loaded, shelf counts take hours, new staff take weeks to learn procedures, and supervisors find problems after they have already cost money.

Cloud AI assistants do not solve this. Many warehouses have unreliable or no internet, and the data (stock levels, suppliers, safety procedures) is commercially sensitive. An assistant that stops working when the connection drops, or that sends inventory data to a third party, will not be trusted on the floor.

An operator needs an assistant that works on the device in front of them, with the network off, that answers from the warehouse's own documents and records, that can read a delivery note or look at a shelf photo, and that never makes up a number.

## Solution

**Warehouse Operations Copilot** is an offline-first assistant for warehouse operators. It runs entirely on the local machine using the QVAC SDK as its only AI layer. After a one-time model download, every feature works with the network disconnected.

From the operator's point of view:

- They **ask** questions by typing or by holding a push-to-talk button. They get answers about procedures (with the source document and section cited), about stock levels and locations, and about what is due to arrive today.
- They **receive** a delivery by photographing the delivery note. The copilot reads it, matches it to the purchase order, shows what it extracted for the operator to correct, and reports exactly what is missing or extra.
- They **count** a shelf by choosing the location, taking a photo, and confirming the number the copilot proposes. The variance against expected stock is calculated and recorded.
- A **supervisor** sees exceptions raised by the floor, an inventory health view (dead stock, slow movers, stockout risk, overstock) and a generated shift handover (nice-to-have features).
- Everywhere, the app shows that it is **100% local**, and a readiness page shows which models are installed and lets the user prepare everything for offline use.

The copilot's trust model is simple and visible. The AI understands language and reads documents and images. **It never invents a quantity, and it never changes inventory.** Numbers come from the database. Every change to inventory is an explicit confirmation by a person.

## User Stories

### Asking and knowledge (F1)

1. As an operator, I want to ask a procedure question in plain language, so that I get an answer without searching through manuals.
2. As an operator, I want every procedure answer to cite its source document and section, so that I can trust it and look it up.
3. As an operator, I want the copilot to say "I don't have an SOP for that" when no relevant document exists, so that I am never given an invented procedure.
4. As an operator, I want safety questions (chemical storage, forklift inspection, PPE per zone) answered from the safety documents, so that I follow the approved rules.
5. As an operator, I want answers to stream as they are generated, so that I can start reading before the answer is complete.
6. As an operator, I want a stop button during generation, so that I can cancel a slow or wrong answer.
7. As an operator, I want to ask follow-up questions such as "where is it?", so that I do not have to repeat the product name.
8. As a new hire, I want to ask how to process returns, handle damaged goods and receive stock, so that I can work correctly during training.
9. As a supervisor, I want procedure answers to be consistent between operators, so that I interrupt less often to explain the same process.
10. As a safety officer, I want SOP and safety documents to be plain Markdown files that I can edit, so that the knowledge base can be updated without a developer.

### Inventory lookup (F2)

11. As an operator, I want to ask "How many generators do we have?", so that I get the current stock without opening an ERP screen.
12. As an operator, I want to ask "Where is SKU 001254 stored?", so that I get aisle, rack and shelf immediately.
13. As an operator, I want to ask about stock by SKU, product name or common synonym, so that I do not have to know exact codes.
14. As an operator, I want the copilot to list candidate products and ask me to choose when my wording matches several, so that it never guesses the wrong item.
15. As an operator, I want the number in every stock answer to come from the inventory records, so that I can rely on it.
16. As an operator, I want to see the record behind an answer (product, location, quantity, last movement), so that I can verify it.
17. As an operator, I want to ask "What stock is below minimum levels?", so that I can flag items that need replenishing.
18. As an operator, I want to ask "Show today's receiving schedule", so that I know what deliveries to expect.
19. As an operator, I want to look up a purchase order by number, so that I can see what was ordered before a delivery arrives.
20. As an operator, I want the copilot to say when a product or location is not found, so that I know to check my wording or the record.

### Voice (F5)

21. As an operator, I want to hold a button and speak my question, so that I can use the copilot while my hands are busy.
22. As an operator, I want to see "I heard: ..." after I speak, so that I can catch a mis-transcription.
23. As an operator, I want my spoken question to send automatically after a short window, so that I stay hands-free.
24. As an operator, I want to edit or cancel the transcript during that window, so that a wrong transcription does not run.
25. As an operator, I want silent or garbled recordings to be ignored with a clear message, so that I am not answered with nonsense.
26. As an operator, I want voice to flow through exactly the same pipeline as typed questions, so that the answers are equally trustworthy.
27. As an operator, I want to say "Where is item A340?" and get a spoken-style short answer in text, so that I get the location quickly.

### Receiving (F3)

28. As a receiving clerk, I want to photograph a delivery note and have the copilot read it, so that I do not type line items by hand.
29. As a receiving clerk, I want the copilot to identify the purchase order from the note, so that comparison is automatic.
30. As a receiving clerk, I want to choose the purchase order manually if the copilot cannot read it, so that I am never blocked.
31. As a receiving clerk, I want to review and edit an extracted-lines table before anything is saved, so that OCR mistakes do not become records.
32. As a receiving clerk, I want to enter or correct the actually received quantity per line, so that the comparison reflects reality.
33. As a receiving clerk, I want to see a clear discrepancy report (for example expected 150 cartons, received 142, missing 8), so that I know exactly what is wrong.
34. As a receiving clerk, I want discrepancies calculated by the system, not estimated by the AI, so that the report is exact.
35. As a receiving clerk, I want lines that are on the note but not on the purchase order to be flagged as unexpected, so that over-deliveries are not missed.
36. As a receiving clerk, I want to confirm the receipt explicitly, so that stock only changes when I decide.
37. As a receiving clerk, I want a confirmed receipt to update stock and create an audit event, so that the record is complete.
38. As a supervisor, I want receipts with discrepancies to appear as exceptions, so that I can follow up with the supplier.

### Image-assisted cycle count (F6)

39. As an operator, I want to choose the location or SKU to count first, by tap or by voice, so that the system knows the expected quantity.
40. As an operator, I want to take a photo of the shelf and get a proposed count, so that counting is faster.
41. As an operator, I want to confirm or edit the proposed count, so that a wrong estimate never becomes a record.
42. As an operator, I want the variance against expected stock calculated for me (for example expected 35, counted 31, variance minus 4), so that I do not do the arithmetic.
43. As an operator, I want to count manually at any time, so that I can continue if the photo or model fails.
44. As an operator, I want guidance on how to take a good photo (one shelf or stack, good light), so that the proposed count is more accurate.
45. As an inventory controller, I want the photo stored with the count record, so that I can review a disputed count later.
46. As an inventory controller, I want counts with variance to be flagged as exceptions, so that I can reconcile them.
47. As an inventory controller, I want stock to be adjusted only by an explicit action after a count, so that a miscount never silently changes inventory.

### Supervisor view (F7, F9 and exceptions)

48. As a supervisor, I want one list of exceptions (receiving discrepancies, count variances, dispatch shortfalls, equipment issues), so that I see problems early.
49. As a supervisor, I want to see dead stock (no movement for 90 days or more), so that I can act on it.
50. As a supervisor, I want to see slow-moving stock (30 days or more), so that I can review turnover.
51. As a supervisor, I want to see products at or below minimum, so that I can prevent stockouts.
52. As a supervisor, I want to see overstock (at or above three times the reorder level), so that I can reduce storage cost.
53. As a supervisor, I want each health finding to have a plain recommendation (for example "Consider promotion or transfer"), so that I know the next step.
54. As a supervisor, I want to generate a shift handover from the shift's recorded events, so that critical information is not lost between shifts.
55. As a supervisor, I want the handover to show the underlying numbers next to the written summary, so that I can verify it.
56. As an incoming shift lead, I want the handover to list deliveries received, orders dispatched, discrepancies and equipment issues, so that I start informed.

### Dispatch verification (F4, nice-to-have)

57. As a dispatch clerk, I want to pick a sales order and enter what was loaded, by voice or by photo of the loading sheet, so that I can verify the truck.
58. As a dispatch clerk, I want the system to compare loaded against ordered per line and alert me to shortfalls (for example ordered 50 pallets, loaded 48, missing 2), so that wrong shipments are caught before departure.
59. As a dispatch clerk, I want to confirm the dispatch explicitly, so that records change only when I decide.

### Offline, readiness and trust

60. As a user, I want a persistent "100% local" indicator, so that I know no data leaves the device.
61. As a user, I want a readiness page that shows each model as installed or missing, so that I know whether the app will work offline.
62. As a user, I want a "Prepare offline" button that downloads everything needed with progress, so that I can get ready while connected.
63. As a user, I want the app to warm up the main models at start and show when it is ready, so that I am not surprised by a slow first answer.
64. As a user, I want the app to make no external network requests at all, so that it works identically with the network off.
65. As a user, I want clear, plain error messages when a model is missing or a step fails, so that I know what to do.
66. As an operator, I want to pick my name and shift when I start, so that my confirmed actions are attributed to me.
67. As a supervisor, I want every confirmed write to be recorded in an audit log, so that actions can be traced.
68. As a demo presenter, I want a one-click reset to the seeded demo data, so that I can repeat the demo from a known state.

### Builders, judges and maintainers

69. As a hackathon judge, I want setup instructions that reproduce the offline demo, so that I can verify the project.
70. As a hackathon judge, I want the README to list the QVAC versions, models, licences, memory needs and the files where QVAC is used, so that I can assess the integration.
71. As a hackathon judge, I want the README to state which features need a network, so that the offline claim is checkable.
72. As a hackathon judge, I want measured accuracy and latency numbers from an eval script, so that the claims are evidence-based.
73. As a developer, I want all QVAC access behind a single interface, so that tests can run without models and the AI layer can be swapped or moved to a separate process.
74. As a developer, I want deterministic logic (discrepancy, variance, health rules, tool routing) covered by fast tests, so that the trust rules cannot silently regress.

## Implementation Decisions

### Domain vocabulary

Use these terms consistently in code, UI and docs.

| Term | Meaning |
|---|---|
| **Operator** | Primary user on the warehouse floor. |
| **Supervisor** | Secondary user. Sees exceptions, health and handover. |
| **Product / SKU** | An item the warehouse stocks. |
| **Location** | Aisle, rack, shelf. |
| **Stock** | Quantity of a product at a location, with last-moved date. |
| **Purchase order (PO)** | What was ordered from a supplier. |
| **Receipt** | A confirmed record of a delivery checked against a PO. |
| **Discrepancy** | Difference between expected and received (or ordered and loaded) quantity, computed in code. |
| **Count** | A confirmed cycle count of a product at a location. |
| **Variance** | Difference between expected and confirmed count, computed in code. |
| **Exception** | Any discrepancy, variance, dispatch shortfall or equipment issue needing supervisor attention. |
| **Event** | An audit-log entry for a confirmed action. |
| **Copilot tool** | A read-only function the language model may call. |
| **ModelPort** | The single interface through which the app uses AI. The QVAC adapter implements it. |
| **Readiness** | Whether each required model is installed and loadable. |
| **Prepare offline** | The step that downloads and caches all required models and ingests the SOPs. |

### Trust rules (non-negotiable)

- The language model never produces a stock quantity, location or discrepancy. These always come from database queries or deterministic code.
- The language model has read-only tools. It can never write to the database.
- Every write (receipt, count, dispatch, stock adjustment) requires an explicit human confirmation in the UI and produces an audit event.
- SOP answers must cite document and section. If retrieval finds nothing relevant above a threshold, the answer is a fixed refusal message, not a model guess.
- Ambiguous product matches produce a candidate list for the operator to choose from.

### Architecture

- **Runtime**: single Next.js application, with QVAC running **in-process in the Node runtime** of the server. No browser-side AI.
- **AI boundary**: one server-only AI module implements the **ModelPort**. No other module imports the QVAC SDK. This is the one place judges look for QVAC usage and the one seam for tests.
- **Model manager**: a process-wide singleton holds loaded models, so hot reload does not reload them. The LLM and embeddings model stay resident. Speech, OCR and vision load on first use and unload after about 5 minutes idle.
- **Spike and fallback**: the first piece of work proves QVAC loads and runs inside Next.js. If native addons cannot be bundled, the same ModelPort is served by a separate local Node process, and the app calls it over local HTTP. The module boundary makes this a transport change, not a redesign.
- **Persistence**: `node:sqlite` with plain SQL schema files and a seed script. No other database. No external vector store.
- **Knowledge base**: Markdown SOP and safety documents, chunked and ingested into QVAC's built-in RAG workspace during Prepare offline. Known limitation: the built-in store is prototype-grade.
- **No external network**: no CDN fonts, analytics, remote images or remote scripts. Assets are bundled. The only network use is the one-time model download.
- **Next.js caution**: this Next.js version has breaking changes. The bundled docs must be read before writing route handlers, configuration or caching behaviour.

### ModelPort interface (behaviour)

| Capability | Input | Output |
|---|---|---|
| Ask | Question, recent history, resolved context, tool set | Streamed events: tokens, tool calls, final answer. Supports cancellation. |
| Retrieve SOP | Question | Ranked passages with document, section and score. |
| Transcribe | 16 kHz mono WAV audio | Text, plus a flag if the transcript was filtered as blank or hallucinated. |
| Read document | Image (delivery note or loading sheet) | OCR text with confidence, then structured fields (PO or order number, supplier, lines of SKU, description and quantity) with per-field confidence. |
| Propose count | Image, product, location | An integer proposal (or "unable to estimate"). |
| Readiness | none | Per-model status (missing, downloading, cached, loaded) with sizes. |
| Prepare | none | Streamed download and ingest progress. |

Tests use a deterministic fake of this interface. The eval script uses the real adapter.

### Copilot tools (read-only)

| Tool | Arguments | Returns |
|---|---|---|
| `get_stock_level` | product query (name, synonym or SKU) | Matching products with quantity per location, or a candidate list when ambiguous. |
| `find_location` | product query | Aisle, rack, shelf per matching product, or a candidate list. |
| `list_below_minimum` | optional category | Products at or below minimum with quantity and minimum. |
| `get_receiving_schedule` | date (default today) | Expected POs with supplier, expected date and line summary. |
| `get_po` | PO number | PO header and lines. |
| `search_sops` | question | Cited passages, or a not-found result. |

Product matching is deterministic: full-text search plus a synonyms table. The model only selects the tool and arguments. Tool results are rendered to the operator as cards showing the underlying records, and the model's text only explains them.

### Data model

Tables: products, locations, stock, purchase orders and PO lines, receipts and receipt lines, sales orders and order lines (with loaded quantity), counts, events, equipment issues, plus a synonyms table and a seeded operators/shifts list.

Key decisions:

- Each product has a **default location**. A confirmed receipt adds received quantity to the default location. Put-away to other locations is out of scope.
- Stock has a **last-moved date** used by the health rules. Every confirmed receipt, dispatch or adjustment updates it.
- A **count** stores expected quantity at the time, the model's proposed value (if any), the confirmed value, the variance, the photo reference and the operator.
- Events record type, operator, shift, timestamp and a structured payload. Shift handover reads only events.
- Seed: about 40 SKUs (including generators, cartons and pallet goods), about 30 locations, 5 POs (one due today with a known 150-expected case), 6 sales orders (one with a 50-pallet case) and 90 days of movement history giving each health category at least one example.

### Feature rules

- **Discrepancy**: per line, difference of expected and received. Also flags lines missing from the delivery and lines not on the PO. Pure function.
- **Variance**: confirmed minus expected. Pure function.
- **Stock adjustment after count**: variance is recorded and raised as an exception automatically. Stock itself changes only when someone explicitly chooses "Adjust stock" on that count. (Spec-level decision, see Further Notes.)
- **Health rules** (configurable constants): dead stock no movement for 90 days or more; slow-moving 30 days or more; stockout risk quantity at or below minimum; overstock quantity at or above 3 times reorder level. Recommendations are fixed templates. The model may rephrase but not alter numbers.
- **Handover**: aggregate events in the selected shift window into a structured summary (deliveries received, orders dispatched, discrepancies, variances, equipment issues). The model writes prose from that structure. The UI shows the structure alongside.
- **Dispatch**: reuses the document-reading capability for the loading sheet, or accepts typed or spoken loaded quantities. Comparison is the same discrepancy function.
- **Voice**: record in the browser, convert to 16 kHz mono WAV in the browser, send for transcription, show "I heard: ...", auto-send after about 2 seconds unless edited or cancelled, filter blank and hallucinated transcripts. No text-to-speech.
- **Memory**: the last 4 messages plus the last resolved product and location are sent with each question. Chat history is not persisted.
- **Users**: no authentication. A seeded operator and shift selector attributes events.

### API contracts (behavioural, not file paths)

| Endpoint | Purpose | Request | Response |
|---|---|---|---|
| Ask | Answer a question | message, recent history, resolved context, operator | Event stream: tokens, tool-result cards, citations, candidate lists, done, error. Cancellable. |
| Transcribe | Speech to text | WAV audio | text, filtered flag |
| Receiving extract | Read a delivery note | image | OCR text, extracted PO number, supplier, lines, per-field confidence |
| Receiving compare | Compute discrepancy | PO number, reviewed lines with received quantities | per-line discrepancy, missing and unexpected lines |
| Receiving confirm | Save receipt | reviewed lines, operator | receipt id, updated stock, event |
| Count propose | Estimate a count | image, location, SKU | proposed integer or unable-to-estimate |
| Count confirm | Save count | location, SKU, confirmed count, proposed count, photo, operator | count with variance, exception raised |
| Count adjust | Adjust stock from a count | count id, operator | updated stock, event |
| Dispatch extract, compare, confirm | As receiving, against sales orders | as above | as above |
| Supervisor exceptions | List exceptions | filters | exception list |
| Supervisor health | Inventory health findings | none | findings by category with recommendations |
| Supervisor handover | Generate handover | shift window | structured summary plus prose |
| Readiness | Model status | none | per-model status |
| Prepare | Download and ingest | none | progress stream |
| Reseed | Reset demo data | none | confirmation |

Errors use one shape: a stable error code and a plain-language message suitable for display.

### Model table (to be filled by the spike)

Candidates come from the QVAC SDK. Values in the measured columns are filled in during the spike and then frozen.

| Role | Candidates | Measured RAM | Measured latency | Licence | Chosen |
|---|---|---|---|---|---|
| LLM with tool calling | Llama 3.2 1B Instruct Q4 and other 1 to 3B instruct models from the SDK registry | TBD | TBD | TBD | TBD |
| Embeddings | Smallest embeddings model that meets retrieval quality (a GTE variant is a known option) | TBD | TBD | TBD | TBD |
| Vision (count) | VisionPsy Nano 460M, SmolVLM2 | TBD | TBD | TBD | TBD |
| OCR | OCR Latin pipeline (CRAFT detector plus Latin recognizer) | TBD | TBD | TBD | TBD |
| Speech to text | Whisper tiny or base with Silero VAD, Parakeet TDT 0.6B Q8 | TBD | TBD | TBD | TBD |

Selection bar: loaded footprint fits in about 3 GB, the model does its job on our test fixtures, licence can be disclosed.

### Provisional quality targets

These are starting targets, to be revised after the spike with real numbers. The submission reports measured results, not these targets.

| Measure | Provisional target |
|---|---|
| Tool selection accuracy on about 20 questions | 85% or better |
| Delivery-note field extraction on clean synthetic notes | 90% of fields correct |
| Proposed count exactly or within 1 of the true count on test photos | 70% or better |
| Time to first token for Ask, models warm | 5 seconds or less |
| Complete typical answer, models warm | 20 seconds or less |
| App ready after start with models cached | 60 seconds or less |
| Total memory with resident models | Within 8 GB machine with headroom |

### UX

- One tablet-friendly responsive app with large touch targets and high contrast.
- Operator views: Ask (chat with always-visible push-to-talk), Receive, Count.
- Supervisor view: exceptions, health, handover (and Dispatch if built).
- Persistent "100% local" badge. Readiness page. Operator and shift selector.
- Visual direction: industrial and utilitarian. High-contrast light theme, safety-yellow accent, very large type, distinct status colours for OK, warning and discrepancy. Details chosen at implementation using the `frontend-design` skill.
- Streaming output with a stop button for every model call. Loading and progress states for model download and first load.

### Delivery constraints

- Submission deadline Friday 30 October 2026, 17:00 EAT. Internal target: submit by noon.
- Offline check Wednesday 28 October: Ask, Inventory, Knowledge and Receiving must work with the network off.
- Cut order if behind: Handover, then Health dashboard, then Dispatch. The five must-haves (Knowledge, Inventory, Receiving, Voice, Count) are never cut.
- Repo root is the solution folder. Public GitHub repo, MIT licence. README discloses the scaffold, all reused code, models and licences, what was built during the event and what needs a network.

## Testing Decisions

**What makes a good test here.** Tests exercise external behaviour at the one seam, not internals. A test states a situation in operator terms (a delivery with 142 of 150 cartons, a shelf expected to hold 35) and asserts what the operator or supervisor would see or what would be recorded. Tests do not assert prompts, internal function calls or model wording.

**The one seam.** The application-service layer that the route handlers call. Tests call it directly with a **real in-memory `node:sqlite` database** built from the real schema, and a **deterministic fake ModelPort** returning scripted tool calls, extractions and counts. Nothing else is mocked.

**Behaviour to cover through that seam:**

- The model cannot cause a write. Only confirm actions change stock, and each produces an audit event.
- Stock answers use database numbers, even when the fake model's text contains different numbers.
- Discrepancy: short, over, missing line, unexpected line, exact match.
- Variance: negative, positive, zero. Variance raises an exception. Stock changes only after explicit adjustment.
- Fuzzy matching: unique match, ambiguous match returns candidates, no match returns not-found.
- SOP: relevant passage returns an answer with a citation. Nothing relevant returns the fixed refusal.
- Health rules at their threshold boundaries, using seeded movement history.
- Handover aggregates only events inside the shift window.
- Dispatch comparison reuses the discrepancy behaviour.
- Voice: filtered transcripts are not sent as questions.
- Reseed restores the demo state exactly.

**Separate from the seam: the offline eval script.** It runs the real QVAC adapter against fixtures (about 20 questions, delivery-note images, shelf photos, short audio clips) and reports tool-call accuracy, extraction accuracy, count accuracy, latency and memory. It is a measurement, not a pass-fail suite, and its results go into the README. It must run with the network off.

**Method.** Deterministic logic is built test-first (`tdd` skill), one behaviour at a time. A **manual offline checklist** covers the demo path: wifi off, then each must-have flow, then the readiness page.

**Prior art.** None. The repo is a fresh scaffold. These tests establish the pattern.

## Out of Scope

- Phase 2 items: forecasting, supplier risk monitoring, predictive maintenance.
- Image, video and music generation, world simulation, fine-tuning, BCI and VLA.
- Text-to-speech and reading answers aloud (stretch only).
- Swahili or any language other than English (stretch only).
- Real WMS or ERP integration, CSV import, multi-site or multi-user sync.
- Authentication, roles and permissions beyond the seeded operator and shift selector.
- Put-away to locations other than a product's default location.
- Barcode and QR scanning hardware.
- Pears, device-to-device features, WDK and any finance functionality.
- A production-grade vector store.
- Browser end-to-end tests.
- Mobile native apps. The app is a responsive web app on the demo machine.

## Further Notes

**Spec-level decisions made while writing (please review).** These were not explicitly discussed in the grilling session. They are my synthesis and are easy to change:

1. Each product has one default location. A confirmed receipt adds stock there, and put-away is out of scope.
2. A confirmed count records the variance and raises an exception, but does not change stock. A separate explicit "Adjust stock" action does.
3. The provisional quality targets in the table above are starting points, not commitments.
4. Seed data must include at least one example for every health category, and the specific demo cases (150 expected and 142 received, 50 pallets ordered and 48 loaded, 35 expected and 31 counted).

**Unresolved until the spike.** The final model table, whether QVAC runs in-process inside Next.js or needs the fallback service, the real memory budget, and whether live microphone capture works through WSL and the Windows browser (fallback: upload an audio file).

**Submission traceability.** The README must carry: QVAC SDK version (0.22.0 at time of writing), model names and download steps, the files where QVAC is used (the single AI module plus the model manager), device and OS, memory needs, model licences, the list of network needs (initial model download only), what was built during the event, and credit for all reused work (create-next-app scaffold, QVAC SDK and models).

**Publishing.** The spec and tickets are kept in `docs/`. After the tickets are written and a GitHub repo exists, they will also be published as GitHub issues with the `ready-for-agent` label. No issue tracker is configured yet, so `setup-matt-pocock-skills` has not been run.
