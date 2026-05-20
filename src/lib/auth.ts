import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppVariables, Env } from '../env';
import { findRobotByTokenHash } from '../db/robots';
import { hashToken } from './token';
import { COOKIE_NAME, verifySession } from './session';

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const bearerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'missing_authorization' }, 401);
  }
  const token = header.slice(7).trim();
  if (token.length < 8) {
    return c.json({ ok: false, error: 'invalid_token' }, 401);
  }
  const hash = await hashToken(token);
  const robot = await findRobotByTokenHash(c.env.DB, hash);
  if (!robot) {
    return c.json({ ok: false, error: 'invalid_token' }, 401);
  }
  c.set('robot', robot);
  await next();
};

export const sessionAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookie = getCookie(c, COOKIE_NAME);
  const session = await verifySession(c.env.SESSION_SECRET, cookie);
  if (!session) {
    // For JSON API endpoints under /admin/api/*, return 401 JSON; else redirect to /admin/login.
    const path = c.req.path;
    if (path.startsWith('/admin/api/') || c.req.header('HX-Request') === 'true') {
      return c.json({ ok: false, error: 'unauthenticated' }, 401);
    }
    return c.redirect('/admin/login');
  }
  c.set('admin', { username: session.username });
  await next();
};
