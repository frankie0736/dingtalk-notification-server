# Changelog

## 0.2.0

- Document DingTalk markdown @-mention asymmetry: only `type=text` triggers a real push.
- Add recommended two-step pattern (text → @push, then markdown → rich detail).
- Fix markdown `@<mobile>` substitution by appending trailing space.

## 0.1.0

- Initial release: `POST /api/v1/notify`, per-robot bearer tokens, AES-GCM at-rest encryption, Hono JSX + htmx admin UI, audit log in D1.
- OpenAPI 3.1 at `/openapi.json`, llms.txt at `/llms.txt`, Scalar reference at `/api-doc`.
