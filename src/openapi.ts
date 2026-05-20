// OpenAPI 3.1 spec describing the public business API.
// Served at /openapi.json so AI agents and tools can self-discover.

export function openApiSpec(baseUrl: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'DingTalk Notification Server',
      version: '0.2.0',
      summary:
        'Send DingTalk group webhook notifications (text with reliable @-push, or markdown for rich content) through a single auditable HTTP endpoint.',
      description: [
        '## Overview',
        '',
        'A multi-tenant relay for DingTalk custom-robot webhooks. Each registered robot has its own bearer token. Callers do not handle DingTalk signing or URL secrets — they just POST a normalized JSON body with `Authorization: Bearer <token>`.',
        '',
        'The server:',
        '1. Authenticates the bearer token → resolves the underlying robot.',
        '2. Decrypts the robot\'s webhook URL and signing secret.',
        '3. Computes the DingTalk HMAC-SHA256 signature.',
        '4. Posts the assembled body to `https://oapi.dingtalk.com/robot/send`.',
        '5. Writes an audit log (request, response, latency) and returns the DingTalk response verbatim.',
        '',
        '## Message types',
        '',
        'Two `type` values are supported:',
        '',
        '- **`text`** — plain text. `at_mobiles` triggers a **real DingTalk @-push** (blue badge + device alert) for each phone number, provided the number belongs to a group member.',
        '- **`markdown`** — rich content (lists, links, bold, blockquotes, code spans). `at_mobiles` does NOT trigger a push notification — DingTalk only substitutes `@<mobile>` in the rendered body with the recipient\'s display name. This is a platform limitation, not a server bug.',
        '',
        '## Recommended pattern for "@ someone with rich detail"',
        '',
        'If you need both reliable @-push AND rich formatting, send two requests:',
        '',
        '1. First a `text` message with a short summary and `at_mobiles` — this delivers the actual notification.',
        '2. Then a `markdown` message carrying the full details. No `at_mobiles` needed.',
        '',
        'Example:',
        '```',
        'POST /api/v1/notify  {"type":"text","content":"🔔 Build #123 failed — see details","at_mobiles":["13800138000"]}',
        'POST /api/v1/notify  {"type":"markdown","title":"Build #123","content":"### main 失败\\n- env: prod\\n- [logs](...)"}',
        '```',
        '',
        '## Authentication',
        '',
        'All `/api/v1/*` endpoints require `Authorization: Bearer <token>`. The token format is `dnk_` followed by 32 base32 characters. Tokens are created in the admin UI and shown only once.',
        '',
        '## Error handling',
        '',
        'Errors are passed through. HTTP 200 with `ok: false` means DingTalk rejected the message (e.g. bad keyword, signature mismatch, rate limit) — read `dingtalk.errcode` and `dingtalk.errmsg`. HTTP 4xx means the request itself was malformed or unauthenticated.',
      ].join('\n'),
      contact: { name: 'API support' },
      license: { name: 'MIT' },
    },
    servers: [{ url: baseUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/notify': {
        post: {
          operationId: 'sendNotification',
          summary: 'Send a notification to the DingTalk group bound to the bearer token',
          tags: ['notify'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotifyRequest' },
                examples: {
                  text_at: {
                    summary: 'Text — triggers a real @-push',
                    value: {
                      type: 'text',
                      content: 'Build #123 failed on main',
                      at_mobiles: ['13800138000'],
                    },
                  },
                  text_at_all: {
                    summary: 'Text — broadcast to everyone',
                    value: { type: 'text', content: 'Server down', at_all: true },
                  },
                  markdown_detail: {
                    summary:
                      'Markdown — rich detail card. Use after a text @ if you also need a push.',
                    value: {
                      type: 'markdown',
                      title: 'Build Failed',
                      content:
                        '### main branch build failed\n\n- env: production\n- elapsed: 42s\n- [View logs](https://example.com)',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description:
                'Request accepted by the server. `ok` reflects whether DingTalk accepted the message (errcode === 0).',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/NotifyResponse' },
                  examples: {
                    ok: {
                      summary: 'DingTalk accepted',
                      value: {
                        ok: true,
                        log_id: 'lg_01h...',
                        dingtalk: { http_status: 200, errcode: 0, errmsg: 'ok' },
                      },
                    },
                    rejected: {
                      summary: 'DingTalk rejected',
                      value: {
                        ok: false,
                        log_id: 'lg_01h...',
                        dingtalk: {
                          http_status: 200,
                          errcode: 310000,
                          errmsg: 'sign not match',
                          raw_body: '{"errcode":310000,"errmsg":"sign not match"}',
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '401': {
              description: 'Missing or invalid bearer token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          operationId: 'healthCheck',
          summary: 'Liveness probe',
          tags: ['ops'],
          security: [],
          responses: {
            '200': {
              description: 'Server is up',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { ok: { type: 'boolean' } },
                    required: ['ok'],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'dnk_<32 base32 chars>',
        },
      },
      schemas: {
        NotifyRequest: {
          oneOf: [
            { $ref: '#/components/schemas/TextNotify' },
            { $ref: '#/components/schemas/MarkdownNotify' },
          ],
          discriminator: {
            propertyName: 'type',
            mapping: {
              text: '#/components/schemas/TextNotify',
              markdown: '#/components/schemas/MarkdownNotify',
            },
          },
        },
        TextNotify: {
          type: 'object',
          required: ['type', 'content'],
          properties: {
            type: { const: 'text' },
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 20000,
              description:
                'Plain text content. Must include any keyword required by the robot security policy.',
            },
            at_mobiles: {
              type: 'array',
              items: { type: 'string', pattern: '^\\+?\\d{6,20}$' },
              maxItems: 50,
              description:
                'Phone numbers to @mention. **Triggers a real DingTalk @-push** in text mode. Each number must belong to a member of the target group — DingTalk silently desensitizes non-member numbers. Mutually exclusive with at_all=true.',
            },
            at_all: {
              type: 'boolean',
              default: false,
              description: 'If true, @all members. Cannot be combined with non-empty at_mobiles.',
            },
          },
        },
        MarkdownNotify: {
          type: 'object',
          required: ['type', 'title', 'content'],
          properties: {
            type: { const: 'markdown' },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Shown in the DingTalk notification preview (not inside the message body).',
            },
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 20000,
              description:
                'Markdown body. Lists, bold, links, code spans, blockquotes are supported. The server auto-appends `@<mobile> ` tokens (with trailing space) for each entry in at_mobiles so DingTalk substitutes the display name in the rendered card.',
            },
            at_mobiles: {
              type: 'array',
              items: { type: 'string', pattern: '^\\+?\\d{6,20}$' },
              maxItems: 50,
              description:
                '**Does NOT trigger a push notification in markdown mode** — DingTalk platform limitation. Listed numbers only render as the recipient\'s display name inside the card. For a real @-push, send a separate text message first.',
            },
            at_all: {
              type: 'boolean',
              default: false,
              description:
                'Even with at_all=true, markdown mode will not produce a real broadcast push. Use type=text for actual broadcast.',
            },
          },
        },
        NotifyResponse: {
          type: 'object',
          required: ['ok', 'log_id', 'dingtalk'],
          properties: {
            ok: {
              type: 'boolean',
              description: 'true only when DingTalk returned errcode === 0.',
            },
            log_id: {
              type: 'string',
              pattern: '^lg_[0-9a-z]+$',
              description: 'Audit log id, viewable in the admin UI at /admin/logs/{log_id}.',
            },
            dingtalk: {
              type: 'object',
              properties: {
                http_status: { type: ['integer', 'null'] },
                errcode: { type: ['integer', 'null'], description: 'DingTalk errcode. 0 means success.' },
                errmsg: { type: ['string', 'null'] },
                raw_body: {
                  type: 'string',
                  description: 'Present only when ok=false. Verbatim response body from DingTalk.',
                },
              },
              required: ['http_status', 'errcode', 'errmsg'],
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['ok', 'error'],
          properties: {
            ok: { const: false },
            error: {
              type: 'string',
              enum: [
                'missing_authorization',
                'invalid_token',
                'invalid_json',
                'validation_failed',
                'server_misconfig',
                'not_found',
                'internal_error',
              ],
            },
            details: { description: 'Additional context. Often a zod issue array for validation_failed.' },
            request_id: { type: 'string' },
          },
        },
      },
    },
  };
}
