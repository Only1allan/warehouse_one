# Warehouse Operations Copilot

**An offline AI assistant for warehouse teams. All AI runs on the device with [QVAC](https://qvac.tether.io). The internet can be switched off.**

Built for **AI Yako: Own Your AI (QVAC Hackathon)**, track **Offline AI apps**.

## The problem

Warehouses still run on paper, spreadsheets, memory and thick SOP binders. The results are wrong receiving counts, wrong items on trucks, slow cycle counts, long training, and supervisors who find problems too late. Cloud AI does not help on a warehouse floor with no reliable connectivity, where stock data is commercially sensitive.

## Who it is for

The four personas from the brief, each with their own sign-in, home screen and sidebar:

| Persona | Needs (from the brief) | What they get |
|---|---|---|
| Warehouse Operator | Quick access to information, voice interaction, inventory verification | Ask the copilot, Safety, Hands-free voice, Receive delivery (from a photo of the note), Count a shelf (from a photo), Check a load |
| Warehouse Supervisor | Operational visibility, exception reporting, inventory alerts | Operations overview with a live feed, Exceptions, Inventory alerts, Stock approvals, Shift handover |
| Inventory Controller | Accurate stock records, faster cycle counts, reconciliation support | Stock records with movement history, a ranked Count plan, Cycle count, Reconciliation |
| Logistics Manager | Dispatch accuracy, shipment visibility, process compliance | Dispatch accuracy, Check a load, Shipments, Compliance, Shift handover |

## What makes it trustworthy

- **The model never writes a number.** Stock levels, locations and discrepancies come from the database and plain arithmetic. The language model only works out what you asked, and writes text around the real figures.
- **A person confirms every change.** The model has read-only tools. Receipts, counts, dispatches and stock adjustments happen only when a person confirms them, and only roles allowed to.
- **Procedures cite their source.** Every procedure or safety answer names the SOP and section. If there is no procedure, it says so.
- **Generated text is checked.** The shift handover is rejected and replaced by a fixed template if the model uses any number that is not in the records.

## Run it

Requirements: Node.js 22.17 or newer, npm, Linux, macOS or Windows (WSL tested), about 8 GB RAM and 4 GB of disk for models. No GPU needed.

```bash
cd web
npm install
npm run build
npm run start                 # http://localhost:3000
```

1. Open http://localhost:3000, choose **Sign in**, and tap one of the demo logins.
2. Open **Readiness** (the "Set up AI" or "AI ready" chip at the top right) and choose **Prepare offline**. This downloads the models once (about 3 GB).
3. Switch the internet off. Everything keeps working.

| Demo login | Username | Password |
|---|---|---|
| Warehouse Operator | `amina` | `Operator@123` |
| Warehouse Supervisor | `daniel` | `Supervisor@123` |
| Inventory Controller | `esther` | `Controller@123` |
| Logistics Manager | `kevin` | `Logistics@123` |

These are demo accounts for synthetic data only. They are shown on the sign-in page on purpose. Set `DEMO_ACCOUNTS=off` to hide them.

For development: `npm run dev`. To reset the demo data: `npm run reseed`.

## Deploy it

This is not a Vercel app. It needs a long-running Node server with a persistent disk, because SQLite, uploaded photos and the ~3 GB of QVAC models all live on the local filesystem. Vercel's serverless functions have a read-only, ephemeral filesystem, so the database cannot survive there.

Deploy the `web` folder to a container host or VPS with 8 GB of RAM and a 20 GB disk:

- **Render:** apply the included `render.yaml`.
- **Fly.io:** use `web/Dockerfile` with a volume mounted at `/data`.
- **Any Docker host:** `docker compose up -d --build` from `web/`.

The database is created and seeded automatically on first request; never commit or upload `warehouse.db`. The first AI use downloads the models once onto the volume. Full steps, environment variables, backups and troubleshooting are in [docs/07-deployment.md](docs/07-deployment.md).

## Offline

- **Laptop:** prepare once, turn Wi-Fi off, keep using `http://localhost:3000`.
- **Phone as a camera and mic:** join the laptop to the phone's hotspot with mobile data **off**, run `npm run phone`, and open the printed `https://` address on the phone. Still no internet.
- **Proof:** `npm run offline:check` runs the app in a Linux network namespace with no network at all and runs every backend and AI check against it.

No APK is needed: the AI runs on the laptop and the phone only uses its browser. See [docs/06-offline-and-devices.md](docs/06-offline-and-devices.md).

### Features that need a network

| Needs a network | When |
|---|---|
| `npm install` | Once, during setup |
| **Prepare offline** (downloads the QVAC models, about 3 GB) | Once, before going offline |
| Phone mode (`npm run phone`) | A **local** Wi-Fi or hotspot between the phone and the laptop. No internet is needed |

Nothing else needs a network. Every AI feature runs with the internet off, and so does everything else: the copilot, procedures, voice, document reading, shelf counting, dispatch checks, the handover, sign-in and all data. There are no CDN fonts (Poppins is bundled), no analytics and no remote images (photos are bundled), and Next.js telemetry is off. This is not a finance entry, so there is no WDK integration and there are no network-dependent finance actions.

If a phone shows "Can't reach the Copilot server" (previously "Failed to fetch") after you go offline, the phone has lost its route to the laptop, not to the internet. Keep the local Wi-Fi or hotspot on and turn off only its internet. If the laptop's IP address changed, run `npm run phone` again and use the new address. See [docs/06-offline-and-devices.md](docs/06-offline-and-devices.md).

## Testing

| Command | What it checks |
|---|---|
| `npm test` | 347 unit tests of every rule, service, permission and trust guarantee |
| `npm run smoke:api` | Every API as every persona: allowed, refused (403), and each role's workflows. Add `-- --ai` for the AI features |
| `npm run test:e2e` | 77 browser tests: landing, sign in, every persona's screens and features, access control, phone layout, no external requests |
| `npm run offline:check` | The full backend and AI check with no network |
| `npm run eval` | Measures the AI on the fixtures, written to `web/eval-results/RESULTS.md` |

A role-by-role manual checklist is in [docs/05-testing-guide.md](docs/05-testing-guide.md).

## QVAC integration

- **SDK:** `@qvac/sdk` 0.22.0 (Apache-2.0), running inside the Next.js server's Node runtime. It brings `@qvac/llm-llamacpp` 0.61.2, `@qvac/embed-llamacpp` 0.48.2, `@qvac/asr-ggml` 0.10.0, `@qvac/ocr-ggml` 0.29.1 and `@qvac/rag` 0.8.1. Tested on Node.js 24.22.
- **Model download and setup:** start the app, sign in, open **Readiness** and choose **Prepare offline**. It calls QVAC `downloadAsset` for each model and stores the files in `~/.qvac/models`. When every row says **Ready**, the network is no longer needed. The models are not committed to the repository.
- **Files that use QVAC:** `web/lib/ai/qvac/qvac-model-port.ts` (every QVAC call), `web/lib/ai/qvac/models.ts` (model choices), `web/lib/ai/qvac/model-manager.ts` (loading, resident models, idle unload). Everything else talks to the `ModelPort` interface in `web/lib/ai/model-port.ts`.
- **QVAC capabilities used:** text generation with tool calling, grammar-constrained tool choice, the KV cache, and JSON-schema structured output; embeddings with the built-in RAG workspace; Parakeet speech to text; OCR; multimodal vision; model download, cache and readiness through `getModelInfo` and `downloadAsset`.

| Role | Model (QVAC constant) | Size | Licence | Why this one |
|---|---|---|---|---|
| Copilot, routing, SOP answers, handover, document extraction | `LLAMA_3_2_1B_INST_Q4_0` (Llama 3.2 1B Instruct) | 773 MB | Llama 3.2 Community License | 87.5% tool choice, 100% correct arguments, about 2 s per question with the KV cache |
| Procedure search | `EMBEDDINGGEMMA_300M_Q4_0` (EmbeddingGemma 300M) | 278 MB | Gemma Terms of Use | Right SOP in the top 3 every time, 28 ms per query |
| Speech to text | `PARAKEET_TDT_0_6B_V3_Q8_0` (NVIDIA Parakeet TDT 0.6B v3) | about 750 MB | CC BY 4.0 | 4.2% word error rate, 0.5 s per clip |
| Reading documents | `OCR_LATIN` (CRAFT detector and Latin recognizer) | about 100 MB | Apache-2.0 (EasyOCR models) | 100% of PO numbers, SKUs and quantities read on the test notes |
| Shelf count proposal | `SMOLVLM2_500M_MULTIMODAL_Q8_0` and its projector | about 550 MB | Apache-2.0 | Lowest error of four vision models, 6.6 s per 512 px photo |

Every candidate and its numbers are in [docs/04-decisions.md](docs/04-decisions.md). The raw model-comparison measurements are in [web/eval-results/](web/eval-results/). `npm run eval` reruns the evaluation on this device and writes a full report to `web/eval-results/RESULTS.md`.

**Device used:** Windows 11 with WSL2 (Ubuntu 26.04), x86_64, 22 CPU threads, about 8 GB RAM for WSL, no GPU. The AI process tree peaks at about 4 to 5 GB with every model loaded (the language and search models stay loaded; speech, OCR and vision load when used and unload after 5 minutes idle).

**Limits:** photo counting is approximate (it proposes, a person confirms). Reading a document takes 20 to 40 s on CPU. The first question after start-up is slower until the cache warms, and the app warms it automatically.

## Architecture

```text
Browser (laptop or phone)  ──HTTP──>  Next.js 16 server on the laptop
                                         ├─ services: receiving, counting, dispatch, health, handover, ...
                                         ├─ SQLite (node:sqlite) on this device
                                         └─ ModelPort ──> QVAC SDK ──> local models (CPU)
```

## What was built during the event

Everything in this repository was built during the hackathon (24 to 30 October 2026), starting from an empty `create-next-app` scaffold. The `docs/` folder records the process: the requirements interview (`01-grill-me.md`), the spec (`02-spec.md`), the tickets (`03-tickets.md`), the decision log with measurements (`04-decisions.md`), and the testing and offline guides.

## Credits and third-party work

- [QVAC SDK](https://github.com/tetherto/qvac) by Tether (Apache-2.0) and the models listed above, under their licences.
- [Next.js](https://nextjs.org), React, Tailwind CSS (MIT). The project began from `create-next-app`.
- [Poppins](https://github.com/itfoundry/Poppins) by Indian Type Foundry (SIL Open Font License, see `web/app/fonts/OFL.txt`).
- Vitest and Playwright for testing.
- Photography and portraits from [Unsplash](https://unsplash.com) under the Unsplash License, bundled in `web/assets` (sources listed in `web/assets/CREDITS.md`).
- All warehouse data, procedures, delivery notes, shelf images and audio clips are synthetic and generated for this project. The audio clips were made with QVAC text-to-speech (Supertonic).

## Licence

MIT. See [LICENSE](LICENSE).
