# Warehouse Operations Copilot (web)

The Next.js application. See the [root README](../README.md) for what it does,
the demo logins and the AI measurements.

## Run locally

```bash
npm install
npm run build
npm run start                 # http://localhost:3000
```

For development use `npm run dev`. On first request the app creates and seeds
`data/warehouse.db`; you do not need a database server.

## Deploy

This is a full-stack Node server, not a static site. It needs a persistent disk
for SQLite, uploads and the QVAC model cache, so it cannot run on Vercel's
serverless filesystem.

Use the included `Dockerfile` on a host with 8 GB of RAM and a 20 GB disk, such
as Render, Fly.io or a VPS. See [docs/07-deployment.md](../docs/07-deployment.md).
The root `render.yaml` is a ready Render Blueprint.
