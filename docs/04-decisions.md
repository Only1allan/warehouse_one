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
