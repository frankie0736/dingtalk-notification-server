import { Hono } from 'hono';
import type { AppVariables, Env } from './env';
import { requestId } from './lib/id';
import { log } from './lib/log';
import { notify } from './routes/notify';
import { admin } from './routes/admin';
import { openApiSpec } from './openapi';
import { llmsText } from './llms';
import { apiDocHtml } from './doc-page';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Tag every request with a correlation id.
app.use('*', async (c, next) => {
  const incoming = c.req.header('X-Request-Id');
  const id = incoming && /^[a-zA-Z0-9_-]{6,64}$/.test(incoming) ? incoming : requestId();
  c.set('request_id', id);
  const startedAt = Date.now();
  c.header('X-Request-Id', id);
  await next();
  const duration = Date.now() - startedAt;
  log('info', id, {
    event: 'http.request',
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    duration_ms: duration,
  });
});

app.get('/', (c) =>
  c.json({
    ok: true,
    service: 'dingtalk-notification-server',
    docs: '/api-doc',
    openapi: '/openapi.json',
    llms: '/llms.txt',
  })
);

app.get('/health', (c) => c.json({ ok: true }));

// AI-discoverable docs (no auth — explicitly public).
app.get('/openapi.json', (c) => {
  const url = new URL(c.req.url);
  return c.json(openApiSpec(`${url.protocol}//${url.host}`));
});
app.get('/llms.txt', (c) => {
  const url = new URL(c.req.url);
  return new Response(llmsText(`${url.protocol}//${url.host}`), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
});
app.get('/api-doc', (c) => {
  const url = new URL(c.req.url);
  return c.html(apiDocHtml(`${url.protocol}//${url.host}`));
});

// Business API
app.route('/api/v1', notify);

// Admin
app.route('/admin', admin);

// JSON 404
app.notFound((c) =>
  c.json({ ok: false, error: 'not_found', path: new URL(c.req.url).pathname }, 404)
);

app.onError((err, c) => {
  const request_id = c.get('request_id') ?? 'unknown';
  log('error', request_id, {
    event: 'http.error',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ ok: false, error: 'internal_error', request_id }, 500);
});

export default app;
