# DingTalk Notification Server

A small Cloudflare Worker that relays DingTalk group chat webhook notifications through a single authenticated HTTP endpoint. Register any number of DingTalk robots, give each one its own bearer token, and let other services POST normalized JSON without dealing with HMAC signing themselves. Every request is audited and visible in the bundled admin UI.

## Why

DingTalk custom robots require you to:

- Hold a `webhook_url` (with `access_token` in the query string) — secret.
- Sign every request with HMAC-SHA256 using a per-robot `secret`.
- Inject `@<mobile>` literals into markdown bodies if you want @mentions to render.

Replicating that in every service (CI, monitoring, CRM, etc.) is repetitive and bug-prone. This server centralizes it.

## Architecture

- Cloudflare Worker (Hono) → D1 (storage) → DingTalk
- AES-GCM at rest for `webhook_url` and `secret` (master key in `MASTER_KEY` secret).
- PBKDF2-SHA256 admin password verification (single admin, env-configured).
- Signed-cookie session for the admin UI.
- Synchronous send; DingTalk's response is passed through verbatim.
- Audit log retained in D1 (no expiry — manual cleanup if needed).

## API

`POST /api/v1/notify` — see [`/openapi.json`](./src/openapi.ts) and [`/llms.txt`](./src/llms.ts) once deployed. Interactive docs at `/api-doc`.

```bash
curl -X POST https://your-worker.workers.dev/api/v1/notify \
  -H "Authorization: Bearer dnk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":"hello","at_mobiles":["13800138000"]}'
```

### Message types and @-mention behavior

DingTalk treats `text` and `markdown` differently:

| Mode | Rich formatting | `at_mobiles` triggers push? |
| --- | --- | --- |
| `text` | No | **Yes** — real blue-badge @ + device notification |
| `markdown` | Yes (lists, links, bold, blockquote, code) | **No** — recipient name renders in the card but no push fires |

This asymmetry is a DingTalk platform limitation, not a server choice.

### Recommended pattern: text + markdown combo

When you need both a reliable @-push **and** rich content, send two requests:

```bash
# 1. Short text with @ — this is the actual notification
curl -X POST .../api/v1/notify -H "Authorization: Bearer dnk_..." \
  -d '{"type":"text","content":"🔔 Build #123 failed — see detail","at_mobiles":["13800138000"]}'

# 2. Markdown card with the full detail (no at_mobiles needed)
curl -X POST .../api/v1/notify -H "Authorization: Bearer dnk_..." \
  -d '{"type":"markdown","title":"Build #123","content":"### main 失败\n- env: prod\n- [logs](https://example.com)"}'
```

Response (success):

```json
{ "ok": true, "log_id": "lg_...", "dingtalk": { "http_status": 200, "errcode": 0, "errmsg": "ok" } }
```

DingTalk rejection (HTTP still 200, `ok: false`, raw body included for debugging):

```json
{ "ok": false, "log_id": "lg_...", "dingtalk": { "http_status": 200, "errcode": 310000, "errmsg": "sign not match", "raw_body": "..." } }
```

## Admin UI

Visit `/admin/login`. Single user, configured via env. Pages:

- `/admin/robots` — register robots, rotate/disable/enable/delete, view token prefix.
- `/admin/logs` — filter audit logs by robot and status, view full payloads.

The bearer token is shown **once** on creation/rotation. Save it then; the server stores only `sha256(token)`.

## Setup

### 1. Install

```bash
bun install
```

### 2. Create the D1 database

```bash
bunx wrangler d1 create dingtalk-notify
```

Wrangler prints a `database_id`. Paste it into `wrangler.jsonc` under `d1_databases[0].database_id`, replacing `REPLACE_AFTER_CREATE`.

### 3. Apply migrations

```bash
bun run db:migrate:local    # for local dev
bun run db:migrate:remote   # before first prod deploy
```

### 4. Configure secrets

Generate values:

```bash
openssl rand -base64 32      # MASTER_KEY
openssl rand -base64 32      # SESSION_SECRET
bun run hash-password 'your-admin-password'   # ADMIN_PASS_HASH
```

#### For local dev (`.dev.vars`)

```bash
cp .dev.vars.example .dev.vars
# paste the values you generated
```

#### For production

```bash
bunx wrangler secret put MASTER_KEY
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put ADMIN_USER
bunx wrangler secret put ADMIN_PASS_HASH
```

> **WARNING:** Rotating `MASTER_KEY` invalidates every stored webhook URL and signing secret. Plan accordingly — keep the old key around, or re-create the robots after rotating.

### 5. Run locally

```bash
bun run dev
```

The Worker starts on `http://localhost:8787`.

### 6. Deploy

```bash
bun run deploy
```

## Adding a robot

1. In DingTalk, in your group: **Settings → Group Assistant → Add Robot → Custom**. Pick the **"加签 (Sign)"** security option. Copy both the `webhook` URL and the `secret`.
2. In `/admin/robots`, paste both and give the robot a name.
3. Copy the displayed token. Store it in your downstream service's secrets.
4. Use that token as `Authorization: Bearer <token>`.

## Project layout

```
src/
  index.ts           Hono app, request_id middleware, route mounting
  env.ts             Bindings + variable types
  openapi.ts         OpenAPI 3.1 spec served at /openapi.json
  llms.ts            llms.txt content for AI agents
  doc-page.ts        HTML page wrapping Scalar API reference
  lib/
    dingtalk.ts      HMAC-SHA256 signing + send()
    crypto.ts        AES-GCM encrypt/decrypt for secrets at rest
    token.ts         Bearer token generate + hash
    password.ts      PBKDF2 admin password verify
    session.ts       Signed-cookie session
    auth.ts          bearerAuth + sessionAuth middlewares
    id.ts            ULIDs for robots / logs / request_ids
    log.ts           Structured JSON logger
  db/
    robots.ts        Robot CRUD
    logs.ts          Audit log write + paged read
  routes/
    notify.ts        POST /api/v1/notify
    admin/
      index.ts       Mounts auth + robots + logs
      auth.tsx       Login / logout
      robots.tsx     Robot CRUD UI
      logs.tsx       Audit log UI
  ui/
    layout.tsx       Shared HTML chrome + CSS
migrations/
  0001_init.sql      robot + notify_log tables
scripts/
  hash-password.ts   PBKDF2 hash CLI
```

## Observability

- Every HTTP request gets a `request_id` (or echoes `X-Request-Id` if the caller supplied one). It appears in every log line for that request and in the response `X-Request-Id` header.
- Logs are structured JSON written to stdout — visible in `wrangler tail` and in the Workers dashboard.
- Audit log (`notify_log` table) records request payload, body sent to DingTalk, response, latency, caller IP/UA — viewable in the admin UI.

## Out of scope (by design)

No queue, no retry, no idempotency, no per-token rate limit. DingTalk's response is passed through; if it returns `errcode != 0`, surface that to the caller and let them decide. ActionCard / FeedCard message types and multi-user RBAC can be added later when actually needed.

## License

MIT
