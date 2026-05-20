// Plain-text quickstart for LLM agents.
// Convention: https://llmstxt.org

export function llmsText(baseUrl: string): string {
  return `# DingTalk Notification Server

A relay service that lets you send DingTalk group chat notifications (text or markdown, with @mobile mentions) through a single authenticated HTTP endpoint. Each robot in the system has its own bearer token; the server holds the DingTalk webhook URL and signing secret on your behalf.

## Discovery

- OpenAPI spec:  ${baseUrl}/openapi.json
- Interactive docs: ${baseUrl}/api-doc
- Health: ${baseUrl}/health

## Key behavior to understand BEFORE picking a message type

DingTalk has an asymmetric @ behavior:
- **type=text + at_mobiles → real push notification** (blue @ badge in card, vibration / banner on device).
- **type=markdown + at_mobiles → name shown in card, NO push.** This is a platform limitation, not a bug. DingTalk substitutes \`@<mobile>\` in the rendered markdown with the recipient's display name but never delivers an actual mention notification.

### Recommended pattern when you need BOTH @-push AND rich content

Send two requests back-to-back:

1. \`type=text\` short summary with \`at_mobiles\` — this is what actually pings the recipient.
2. \`type=markdown\` with the full detail card. No need to include \`at_mobiles\` here.

## Send a notification

POST ${baseUrl}/api/v1/notify
Headers:
  Authorization: Bearer dnk_<32 chars>
  Content-Type: application/json

### Body — plain text with real @-push

{
  "type": "text",
  "content": "Build #123 failed on main",
  "at_mobiles": ["13800138000"]
}

### Body — markdown detail card (no @-push, for rich content)

{
  "type": "markdown",
  "title": "Build Failed",
  "content": "### main branch build failed\\n\\n- env: production\\n- elapsed: 42s\\n- [View logs](https://example.com)"
}

### Body — @everyone in the group (text only, broadcast)

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

## Phone number format

E.164-ish: optional leading "+", then 6-20 digits. Examples: "13800138000", "+8613800138000". The number must belong to a member of the target DingTalk group — DingTalk silently desensitizes non-member numbers and the @ does not fire.

## Idempotency / retries / rate limiting

Not implemented. The server posts every request to DingTalk verbatim and surfaces DingTalk's response unchanged. DingTalk itself rate-limits each robot to 20 messages per minute; over-limit calls return errcode=130101 (or similar) and you should back off.

## curl examples

# Push + detail in two calls:
curl -X POST ${baseUrl}/api/v1/notify \\
  -H "Authorization: Bearer dnk_REPLACE_ME" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","content":"🔔 Build failed — see details","at_mobiles":["13800138000"]}'

curl -X POST ${baseUrl}/api/v1/notify \\
  -H "Authorization: Bearer dnk_REPLACE_ME" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"markdown","title":"Build #123","content":"### main 失败\\n- env: prod\\n- [logs](https://example.com)"}'
`;
}
