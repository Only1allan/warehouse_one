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
