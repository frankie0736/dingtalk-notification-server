// Plain-text quickstart for LLM agents.
// Convention: https://llmstxt.org

export function llmsText(baseUrl: string): string {
  return `# DingTalk Notification Server

A relay service that lets you send DingTalk group chat notifications (text or markdown, with @mobile mentions) through a single authenticated HTTP endpoint. Each robot in the system has its own bearer token; the server holds the DingTalk webhook URL and signing secret on your behalf.

## Discovery

- OpenAPI spec:  ${baseUrl}/openapi.json
- Interactive docs: ${baseUrl}/api-doc
- Health: ${baseUrl}/health

## Send a notification

POST ${baseUrl}/api/v1/notify
Headers:
  Authorization: Bearer dnk_<32 chars>
  Content-Type: application/json

### Body — plain text

{
  "type": "text",
  "content": "Build #123 failed on main",
  "at_mobiles": ["13800138000"]
}

### Body — markdown (title is required)

{
  "type": "markdown",
  "title": "Build Failed",
  "content": "### main branch build failed\\n\\n[View logs](https://example.com/logs)",
  "at_mobiles": ["13800138000", "13900139000"]
}

### Body — @everyone in the group

{ "type": "text", "content": "Server down", "at_all": true }

Note: at_all=true and a non-empty at_mobiles array are mutually exclusive.

## Response shape (all 200 OK)

Success:
  { "ok": true,  "log_id": "lg_...", "dingtalk": { "http_status": 200, "errcode": 0, "errmsg": "ok" } }

DingTalk rejected the message (signature, keyword, rate, etc):
  { "ok": false, "log_id": "lg_...", "dingtalk": { "http_status": 200, "errcode": 310000, "errmsg": "sign not match", "raw_body": "..." } }

Treat ok=false as a soft failure to inspect, not a network error.

## Error responses (4xx/5xx)

  401 { "ok": false, "error": "missing_authorization" | "invalid_token" }
  400 { "ok": false, "error": "invalid_json" | "validation_failed", "details": ... }
  500 { "ok": false, "error": "internal_error", "request_id": "rq_..." }

## At-mention behavior

- text: at_mobiles are passed to DingTalk's "at.atMobiles". The mention renders.
- markdown: DingTalk requires the literal "@<mobile>" tokens to be in the markdown body. The server auto-appends them, so callers do not need to.

## Phone number format

E.164-ish: optional leading "+", then 6-20 digits. Examples: "13800138000", "+8613800138000".

## Idempotency / retries / rate limiting

Not implemented. The server posts every request to DingTalk verbatim and surfaces DingTalk's response unchanged. DingTalk itself rate-limits each robot to 20 messages per minute; over-limit calls return errcode=130101 (or similar) and you should back off.

## curl example

curl -X POST ${baseUrl}/api/v1/notify \\
  -H "Authorization: Bearer dnk_REPLACE_ME" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","content":"hello from agent","at_mobiles":["13800138000"]}'
`;
}
