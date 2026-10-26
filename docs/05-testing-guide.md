# 05 - How to test every feature, for every role

This guide shows how to check that each persona has the tools the brief asks for and that every backend function works. There are two ways: **by hand in the browser** (section 2) and **automatically** (section 3). Section 4 shows how to call the API directly.

All commands run from the `web/` folder.

## 1. Start the app

```bash
cd web
npm install
npm run reseed          # puts the demo data in its starting state
npm run dev             # http://localhost:3000
```

The first time, sign in as any user, open **Readiness** (the "AI ready" chip at the top right) and choose **Prepare offline** to download the models once (about 3 GB). After that no network is needed. Section 2 of `06-offline-and-devices.md` explains offline use.

**Demo logins** (also shown on the sign-in page, with one-tap fill):

| Persona | Username | Password | What the brief says they need |
|---|---|---|---|
| Warehouse Operator | `amina` (also `brian`, `chebet`) | `Operator@123` | Quick access to information, voice interaction, inventory verification |
| Warehouse Supervisor | `daniel` | `Supervisor@123` | Operational visibility, exception reporting, inventory alerts |
| Inventory Controller | `esther` | `Controller@123` | Accurate stock records, faster cycle counts, reconciliation support |
| Logistics Manager | `kevin` | `Logistics@123` | Dispatch accuracy, shipment visibility, process compliance |

The three operator logins share the operator role, so their sidebars are the same. Each of the four personas has a different sidebar, grouped under the needs above.

## 2. Test by hand, persona by persona

Reset the data first (`npm run reseed`, or **Readiness > Reset demo data** as the supervisor) so the numbers below match.

### Warehouse Operator (`amina`)

Sidebar: My shift · *Quick access to information:* Ask the copilot, Safety · *Voice interaction:* Hands-free · *Inventory verification:* Receive delivery, Count a shelf, Check a load.

| Feature (brief) | Steps | What you should see |
|---|---|---|
| F2 Inventory lookup | Ask: "How many generators do we have?" | "We currently have 43 units of Portable Generator 5kW in stock." and a card with location B-4-2 |
| F2 Inventory lookup | Ask: "Where is SKU 001254 stored?" then "where is it?" | "Aisle B, Rack 4, Shelf 2 (B-4-2)". The follow-up uses the same product |
| F2 Ambiguity | Ask: "How many gloves?" | Two candidate products to choose from, no guess |
| Low stock, schedule, PO | "What stock is below minimum levels?", "Show today's receiving schedule.", "What is on PO 4471?" | Lists with the exact records (PO 4471 and 4472 due today) |
| F1 Knowledge copilot | Ask: "What should I do with damaged inventory?" | Quarantine area and form WH-QA-04, with a **Sources** list naming the SOP and section |
| F1 Refusal | Ask: "How do I fly a helicopter?" | "I don't have an SOP for that..." |
| F8 Safety copilot | **Safety**: tap "What PPE is required in Zone C?" | Hi-vis, boots, cut-resistant gloves, cited from SOP WH-SF-01 |
| F5 Voice | **Hands-free**: hold the big button, say "Where is item A340?", let go | "I heard: ..." appears, then the answer after 2 s (or upload a WAV from `data/fixtures/audio/`) |
| F3 Receiving | **Receive delivery** > PO 4471 > enter 142, 60, 120 > Confirm | "expected 150, received 142 (missing 8)". The receipt is saved and the discrepancy goes to the supervisor |
| F3 Receiving from a photo | **Receive delivery** > Photograph the delivery note > choose `data/fixtures/images/delivery-note-4471-clean.png` | PO 4471 is selected for you and "On note 150" appears next to each line. You still count what arrived |
| F6 Cycle count | **Count a shelf** > search "hose" > Hydraulic Hose Kit > enter 31 | "Expected 35, Counted 31, Variance −4". Confirm: stock does **not** change. The variance waits for approval |
| F6 Count from a photo | Same, then "Take a photo..." > `data/fixtures/images/shelf-35.png` | A proposed count to check and correct (photo counting is approximate, see the eval results) |
| F4 Dispatch | **Check a load** > Order 5521 > enter 48 > Confirm | "Dispatch incomplete... ordered 50, loaded 48 (missing 2)" |
| Equipment issue | **My shift** > Report an equipment issue | "Forklift F01 reported", visible to the supervisor |

The operator **cannot** open Exceptions, Inventory alerts, Stock records, Shipments or the handover. Typing those URLs shows "Not available for your role".

### Warehouse Supervisor (`daniel`)

Sidebar: *Operational visibility:* Operations overview, Shift handover · *Exception reporting:* Exceptions · *Inventory alerts:* Inventory alerts, Stock approvals · Ask the copilot.

| Feature (brief) | Steps | What you should see |
|---|---|---|
| Operational visibility | **Operations overview** after the operator's steps above | "Today on the floor": receipts, dispatches, counts, issues, plus a feed of who did what |
| Exception reporting | **Exceptions**, filter by type and shift, open a row | Receiving, count, dispatch and equipment exceptions. Each row opens the record behind it |
| F7 Inventory alerts | **Inventory alerts**, filter Dead stock | "Product P-324 has not moved in ... days. Consider promotion or transfer." |
| Approvals | **Stock approvals** > Approve on the Hydraulic Hose Kit count | Stock becomes 31 and the count moves to "Recently reconciled" |
| F9 Shift handover | **Shift handover** > pick a recent shift > Write the handover | A short summary written by the local model, with every number shown beside it. Numbers the model makes up are rejected |
| Reset demo data | Readiness > Reset demo data > Yes, reset | Data back to the starting state (supervisor only) |

### Inventory Controller (`esther`)

Sidebar: Accuracy overview · *Accurate stock records:* Stock records · *Faster cycle counts:* Count plan, Cycle count · *Reconciliation support:* Reconciliation · Ask the copilot.

| Feature (brief) | Steps | What you should see |
|---|---|---|
| Accurate stock records | **Stock records** > search "generator" > open it | Locations, recent movements, incoming PO 4473 and order 5523 promised |
| Faster cycle counts | **Count plan** | A ranked list with the reasons ("Never counted", "At or below minimum", "Last count was off by -4"). **Count now** opens the count for that product |
| Cycle count | **Cycle count** | Same count flow as the operator, and the controller can adjust stock right after a count |
| Reconciliation support | **Reconciliation** > type a reason > Decline on Bearing 6205 | Stock stays 180 and the reason is recorded. Approve corrects stock instead |

### Logistics Manager (`kevin`)

Sidebar: Logistics overview · *Dispatch accuracy:* Dispatch accuracy, Check a load · *Shipment visibility:* Shipments · *Process compliance:* Compliance, Shift handover · Ask the copilot.

| Feature (brief) | Steps | What you should see |
|---|---|---|
| Dispatch accuracy | **Dispatch accuracy** | 50% loaded in full (1 of 2), 96.7% of units, shortfall: order 5520 loaded 18 of 20 |
| Dispatch accuracy | **Check a load** > order 5522 > 30 and 20 > Confirm, then reopen Dispatch accuracy | The figures update |
| Shipment visibility | **Shipments** | Every order with status: waiting to load, dispatched in full, dispatched short |
| Process compliance | **Compliance** | Receipts, dispatches and counts that followed procedure, and open exceptions by process |

## 3. Test automatically

| Command | What it checks | Time |
|---|---|---|
| `npm test` | 313 unit tests of the backend: every rule, service, permission and the trust guarantees (the model can never write, invented numbers are rejected) | about 30 s |
| `npm run smoke:api` | **Every API, as every persona**, against the running app: each role reaches exactly its endpoints and is refused (403) for the rest. Then each role's real workflow. Prints PASS or FAIL per check | about 10 s |
| `npm run smoke:api -- --ai` | The same, plus every AI feature: asking, cited SOP answers, voice transcription, reading a delivery note, proposing a count, the handover | a few minutes |
| `npm run test:e2e` | 77 browser tests: landing, sign in, every persona's sidebar and screens, each feature end to end, access control, no external requests, phone-sized screens | about 10 min |
| `npm run offline:check` | Runs the app in a network namespace with **no network at all**, then the full `smoke:api --ai` against it | a few minutes |
| `npm run eval` | Measures the AI on the fixtures: tool routing, SOP retrieval, document reading, counting, speech, latency, memory. Writes `eval-results/RESULTS.md` | 10 to 20 min |

`smoke:api` resets the demo data of the server it targets. Point it at another server with `--base`, for example `npm run smoke:api -- --base http://localhost:3101`.

Example `smoke:api` output:

```text
PASS  security             every API refuses a request with no session  (19 endpoints)
PASS  operator             can reach exactly the endpoints of its role  (9 allowed, 10 refused)
PASS  supervisor           can reach exactly the endpoints of its role  (6 allowed, 13 refused)
PASS  inventory_controller can reach exactly the endpoints of its role  (7 allowed, 12 refused)
PASS  logistics_manager    can reach exactly the endpoints of its role  (9 allowed, 10 refused)
PASS  operator             receive PO 4471 with 142 of 150 cartons: missing 8, exception raised
...
22 passed, 0 failed
```

## 4. Call the API yourself

Every endpoint needs a session cookie, and each role is allowed a fixed set (see `lib/auth/capabilities.ts`).

```bash
# sign in and keep the cookie
curl -s -c /tmp/wh.jar -H 'content-type: application/json' \
  -d '{"username":"amina","password":"Operator@123"}' http://localhost:3000/api/auth/signin

# inventory lookup through the copilot (server-sent events)
curl -s -N -b /tmp/wh.jar -H 'content-type: application/json' \
  -d '{"message":"How many generators do we have?"}' http://localhost:3000/api/ask

# compare a delivery against its PO (no change is saved)
curl -s -b /tmp/wh.jar -H 'content-type: application/json' \
  -d '{"poNumber":"4471","lines":[{"sku":"100201","qty":142},{"sku":"100305","qty":60},{"sku":"100410","qty":120}]}' \
  http://localhost:3000/api/receiving/compare

# transcribe a spoken question
curl -s -b /tmp/wh.jar --data-binary @data/fixtures/audio/question-01.wav http://localhost:3000/api/voice/transcribe

# read a delivery note photo
curl -s -b /tmp/wh.jar -F image=@data/fixtures/images/delivery-note-4472.png http://localhost:3000/api/receiving/extract

# an operator asking for supervisor data is refused
curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/wh.jar http://localhost:3000/api/health   # 403
```

| Area | Endpoints | Roles |
|---|---|---|
| Account | `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/me`, `POST /api/auth/shift`, `GET /api/auth/demo-logins` | public or signed in |
| Copilot | `POST /api/ask`, `POST /api/voice/transcribe` | all |
| Home | `GET /api/home` (different content per role) | all |
| Receiving | `GET /api/receiving/pos`, `GET /api/receiving/po/{po}`, `POST /api/receiving/compare`, `POST /api/receiving/confirm`, `POST /api/receiving/extract` | operator |
| Counting | `GET /api/count/targets`, `POST /api/count/confirm`, `POST /api/count/propose` | operator, inventory controller |
| Count plan | `GET /api/count-plan` | inventory controller |
| Stock records | `GET /api/stock`, `GET /api/stock/{sku}` | inventory controller |
| Reconciliation | `GET /api/stock/reconciliations`, `POST /api/count/adjust`, `POST /api/stock/decline` | supervisor, inventory controller |
| Dispatch | `GET /api/dispatch/orders`, `GET /api/dispatch/order/{n}`, `POST /api/dispatch/compare`, `POST /api/dispatch/confirm`, `POST /api/dispatch/extract` | operator, logistics manager |
| Logistics | `GET /api/shipments`, `GET /api/logistics/accuracy`, `GET /api/logistics/compliance` | logistics manager |
| Supervisor | `GET /api/supervisor/exceptions`, `GET /api/supervisor/exceptions/{id}`, `GET /api/health` | supervisor |
| Equipment | `POST /api/supervisor/equipment-issues` | all |
| Handover | `GET /api/handover/windows`, `POST /api/handover` | supervisor, logistics manager |
| Models | `GET /api/readiness`, `POST /api/readiness`, `POST /api/readiness/prepare` | all |
| Demo data | `POST /api/admin/reseed` | supervisor |
