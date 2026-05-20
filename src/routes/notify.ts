import { Hono } from 'hono';
import { z } from 'zod';
import type { AppVariables, Env } from '../env';
import { bearerAuth } from '../lib/auth';
import { decrypt } from '../lib/crypto';
import { buildDingTalkBody, send } from '../lib/dingtalk';
import { logId } from '../lib/id';
import { log } from '../lib/log';
import { insertLog } from '../db/logs';

type AppEnv = { Bindings: Env; Variables: AppVariables };

const TextBody = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(20000),
  at_mobiles: z.array(z.string().regex(/^\+?\d{6,20}$/)).max(50).optional(),
  at_all: z.boolean().optional(),
});

const MarkdownBody = z.object({
  type: z.literal('markdown'),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  at_mobiles: z.array(z.string().regex(/^\+?\d{6,20}$/)).max(50).optional(),
  at_all: z.boolean().optional(),
});

const NotifyBody = z.discriminatedUnion('type', [TextBody, MarkdownBody]);

export const notify = new Hono<AppEnv>();

notify.post('/notify', bearerAuth, async (c) => {
  const request_id = c.get('request_id');
  const robot = c.get('robot');
  if (!robot) {
    // bearerAuth guarantees this, but type system needs the check.
    return c.json({ ok: false, error: 'invalid_token' }, 401);
  }

  const raw = await c.req.text();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = NotifyBody.safeParse(parsedJson);
  if (!parsed.success) {
    return c.json(
      { ok: false, error: 'validation_failed', details: parsed.error.issues },
      400
    );
  }
  const body = parsed.data;

  if (body.at_all && body.at_mobiles && body.at_mobiles.length > 0) {
    return c.json(
      { ok: false, error: 'validation_failed', details: 'at_all and at_mobiles are mutually exclusive' },
      400
    );
  }

  const caller_ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null;
  const caller_ua = c.req.header('User-Agent') ?? null;

  let webhook: string;
  let secret: string;
  try {
    webhook = await decrypt(c.env.MASTER_KEY, robot.webhook_enc);
    secret = await decrypt(c.env.MASTER_KEY, robot.secret_enc);
  } catch (err) {
    log('error', request_id, {
      event: 'notify.decrypt_failed',
      robot_id: robot.id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return c.json({ ok: false, error: 'server_misconfig' }, 500);
  }

  const dtBody = buildDingTalkBody({
    type: body.type,
    content: body.content,
    title: 'title' in body ? body.title : undefined,
    at_mobiles: body.at_mobiles,
    at_all: body.at_all,
  });
  const dtBodyStr = JSON.stringify(dtBody);

  const id = logId();
  const startedAt = Date.now();
  let http_status: number | null = null;
  let errcode: number | null = null;
  let errmsg: string | null = null;
  let raw_body = '';

  try {
    const resp = await send(webhook, secret, dtBody);
    http_status = resp.http_status;
    errcode = resp.errcode;
    errmsg = resp.errmsg;
    raw_body = resp.raw_body;
  } catch (err) {
    errmsg = err instanceof Error ? err.message : 'network_error';
    log('error', request_id, {
      event: 'notify.send_failed',
      robot_id: robot.id,
      message: errmsg,
    });
  }
  const latency_ms = Date.now() - startedAt;

  await insertLog(c.env.DB, {
    id,
    robot_id: robot.id,
    caller_ip,
    caller_ua,
    msg_type: body.type,
    at_mobiles: body.at_mobiles ?? null,
    at_all: body.at_all === true,
    request_payload: raw,
    dingtalk_body: dtBodyStr,
    http_status,
    dingtalk_errcode: errcode,
    dingtalk_errmsg: errmsg,
    latency_ms,
  });

  log('info', request_id, {
    event: 'notify.sent',
    robot_id: robot.id,
    log_id: id,
    msg_type: body.type,
    at_count: body.at_mobiles?.length ?? 0,
    at_all: body.at_all === true,
    http_status,
    dingtalk_errcode: errcode,
    latency_ms,
  });

  const ok = errcode === 0;
  return c.json({
    ok,
    log_id: id,
    dingtalk: {
      http_status,
      errcode,
      errmsg,
      ...(ok ? {} : { raw_body }),
    },
  });
});
