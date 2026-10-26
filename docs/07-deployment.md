# 07 - Deploying the app

## Short answer: Vercel cannot run this app as-is

Deploying the `web` folder is the right unit to deploy. The database is not a
separate SQL server and there is no database folder outside `web/`: the app
creates and seeds `web/data/warehouse.db` itself on first request.

The problem is the host, not the folder. Vercel runs each request in a
serverless function:

- The filesystem is **read-only**, except for `/tmp`, and `/tmp` is
  **per-invocation and ephemeral**. `node:sqlite` cannot create or keep
  `warehouse.db`; uploaded count photos and the session secret have the same
  problem.
- Functions are **stateless and can run on many instances at once**. SQLite is a
  single local file, so a write on one instance would be invisible to the next
  request.
- The app runs **QVAC locally** in the Next.js server. A function would need the
  ~3 GB model download, several GB of RAM, a long-running process and a
  persistent cache. Vercel's size, memory, duration and filesystem limits rule
  that out.
- The `@qvac` native packages alone are much larger than a serverless bundle.

A hosted Postgres/Turso database plus Vercel Blob would fix only the first two
points and would still leave the AI without a host. That is a different
architecture and it loses the "runs offline on the device" property. If the app
is going to stay as designed, move it to a small server with a disk.

## What the app needs

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB (models are tight) | 8 GB |
| Disk | 10 GB | 20 GB |
| Architecture | Linux x86_64 or arm64 | either |
| Instances | 1 | 1 (never autoscale) |
| Filesystem | persistent volume | persistent volume |
| Network at runtime | none after the one-time model download | |

The disk holds three things that must survive restarts and deploys:

```text
/data/warehouse.db            SQLite database (created and seeded automatically)
/data/uploads/counts/         photos uploaded for counting
/data/home/.qvac/             ~3 GB of models, KV caches and the SOP index
```

The container in `web/Dockerfile` already points the app at those paths. The
app's defaults remain unchanged for local development.

## Environment variables

Set these on the host. The Docker image sets the first four already; setting
them explicitly makes the deployment easier to audit.

| Variable | Value | Why |
|---|---|---|
| `WAREHOUSE_DB_PATH` | `/data/warehouse.db` | SQLite file on the volume |
| `WAREHOUSE_UPLOAD_DIR` | `/data` | uploaded photos under `/data/uploads` |
| `HOME` | `/data/home` | QVAC writes `~/.qvac` here, not the ephemeral home |
| `SESSION_SECRET` | 64 random hex characters | keeps sessions valid across restarts |
| `DEMO_ACCOUNTS` | `on` (default) or `off` | show/hide the demo logins |
| `PORT` | supplied by the host | Next.js reads it |
| `NEXT_TELEMETRY_DISABLED` | `1` | no telemetry (already set in the image) |

Generate a secret with:

```bash
openssl rand -hex 32
```

Do **not** put `SESSION_SECRET` in git.

## Option A: Render (Blueprint included)

The repository has a `render.yaml` that creates one Docker web service on the
8 GB plan with a 20 GB disk mounted at `/data`.

1. Push the repository to GitHub. The database is not committed (it is in
   `.gitignore`) and does not need to be; it is created and seeded on first
   request.
2. In Render: **New > Blueprint**, connect the repository, and apply
   `render.yaml`.
3. If you prefer the dashboard instead: create a **Web Service**, choose
   **Docker**, set the root directory to `web`, and add a disk with mount path
   `/data` and 20 GB.
4. Set `SESSION_SECRET` (Render can generate it) and keep `DEMO_ACCOUNTS=on`
   for the demo.
5. Wait for the image build. It downloads the QVAC native packages, so the
   first build is slow. Deploys after that are cached.
6. Open the service URL, sign in with a demo account, open **Readiness** and
   choose **Prepare offline** once. About 3 GB of models are downloaded to
   `/data/home/.qvac` and stay on the disk.

The 8 GB plan is a paid plan. Do not use Render's free or 512 MB instance: the
server will be killed before the models load. A disk also prevents scaling to
more than one instance, which is correct for SQLite.

## Option B: Fly.io

Create a volume and deploy the same Docker image from `web/`:

```bash
cd web
fly launch --no-deploy
fly volumes create warehouse_data --size 20 --region fra
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"
fly deploy
```

Use a `fly.toml` with one machine, a mount at `/data`, and 8 GB of memory:

```toml
app = "warehouse-copilot"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "8gb"
  cpu_kind = "performance"
  cpus = 2

[mounts]
  source = "warehouse_data"
  destination = "/data"
```

Keep the machine count at 1 (`fly scale count 1`). The volume is attached to a
single machine, so the app cannot be scaled horizontally.

## Option C: Any VPS or Docker host

From `web/`:

```bash
cat > .env <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
DEMO_ACCOUNTS=on
EOF

docker compose up -d --build
```

The compose file builds the image, publishes port 3000, mounts the named
volume `warehouse-data` at `/data`, and gives the container 8 GB of memory.
Check it:

```bash
docker compose ps
docker compose logs -f app
curl -I http://127.0.0.1:3000/
```

For a real URL, put Caddy, nginx or another reverse proxy in front and use
HTTPS. Camera and microphone access on a phone only works on `https://` (or
`localhost`). A minimal Caddy config:

```caddyfile
copilot.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Only expose ports 80 and 443; keep 3000 on the loopback interface. Do not run
more than one container against the same SQLite volume.

## Option D: a temporary link from your own machine (no cloud host)

If you only need a URL for judges and the laptop will stay on, run the app as
usual and put a tunnel in front of it:

```bash
# terminal 1
cd web
npm run build
npm run start

# terminal 2
cloudflared tunnel --url http://localhost:3000
```

Cloudflare prints an `https://...trycloudflare.com` URL. It is HTTPS, so phone
camera and microphone work. This keeps the database and models on your own
laptop, which is the design of the app. The link stops working when the laptop
sleeps or the tunnel process exits, so it is a demo aid, not a deployment.

## After the first deploy

1. Open the site and sign in with a demo account (`amina` / `Operator@123`, see
   the root README for the others).
2. Open **Readiness > Prepare offline** and wait until every model says
   **Ready**. This is the only step that needs outbound internet.
3. Ask a question, upload a delivery note, and restart the service once to prove
   the database and models survived.
4. Delete the Vercel project, or keep it only as a landing page that links here.
   Its sign-in and API routes will not work.

## Backups

The whole state is under `/data`. To back it up on a VPS, stop the app and copy
the volume:

```bash
docker compose stop app
docker run --rm \
  -v web_warehouse-data:/data:ro \
  -v "$PWD:/backup" \
  alpine tar czf /backup/warehouse-backup.tgz -C /data .
docker compose start app
```

The volume name may differ if the compose project is not named `web`; check
`docker volume ls`.

On Render, use the disk snapshot/backup feature if your plan provides it. The
minimum backup is `warehouse.db`, `uploads/` and `.qvac/` (the models can be
downloaded again, but keeping them avoids a 3 GB download).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EROFS`, `SQLITE_CANTOPEN`, `attempt to write a readonly database` | no volume, or the path is outside `/data` | mount a disk at `/data` and keep the env vars above |
| Data resets after every deploy | database is on the ephemeral filesystem, or more than one instance | put it on the volume and run one instance |
| `CUDA`/native package errors | image built for a different architecture | build on the target platform (or use the platform's native builder) |
| 502/504 on first AI use | models are still downloading or RAM is too low | watch the logs; use 8 GB |
| AI says models are missing after restart | `HOME` is not on the volume | set `HOME=/data/home` |
| Signed out after every restart | `SESSION_SECRET` is not set | set it once and keep it |
| Container starts then exits with a permission error | the disk is root-owned and the entrypoint could not drop privileges | check the `gosu` install and the `/data` mount |

## What not to do on Vercel

- Do not commit `warehouse.db` to make the data appear. The deployed copy is
  still read-only and per-instance.
- Do not point `WAREHOUSE_DB_PATH` at `/tmp`. It may work for one request and
  then disappear, and the app will re-seed on every cold start.
- Do not run model downloads on Vercel. The response stream will be cut off and
  the cache cannot persist.
