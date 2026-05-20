/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { AppVariables, Env } from '../../env';
import { verifyPassword } from '../../lib/password';
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  createSession,
} from '../../lib/session';
import { Layout } from '../../ui/layout';
import { log } from '../../lib/log';

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const adminAuth = new Hono<AppEnv>();

adminAuth.get('/login', (c) => {
  const error = c.req.query('error');
  return c.html(
    <Layout title="Login">
      <div class="login-wrap">
        <section>
          <h2>Sign in</h2>
          {error ? <div class="alert alert-err">Invalid credentials</div> : null}
          <form method="post" action="/admin/login">
            <div class="field">
              <label for="username">Username</label>
              <input id="username" name="username" type="text" required autofocus />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" required />
            </div>
            <button class="btn btn-primary" type="submit" style="width: 100%;">
              Sign in
            </button>
          </form>
        </section>
      </div>
    </Layout>
  );
});

adminAuth.post('/login', async (c) => {
  const form = await c.req.parseBody();
  const username = String(form.username ?? '').trim();
  const password = String(form.password ?? '');
  const request_id = c.get('request_id');

  if (!username || !password) {
    return c.redirect('/admin/login?error=1');
  }

  if (username !== c.env.ADMIN_USER) {
    log('warn', request_id, { event: 'login.failed', reason: 'bad_user' });
    return c.redirect('/admin/login?error=1');
  }

  const ok = await verifyPassword(password, c.env.ADMIN_PASS_HASH);
  if (!ok) {
    log('warn', request_id, { event: 'login.failed', reason: 'bad_password' });
    return c.redirect('/admin/login?error=1');
  }

  const cookieValue = await createSession(c.env.SESSION_SECRET, username);
  const url = new URL(c.req.url);
  setCookie(c, COOKIE_NAME, cookieValue, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: url.protocol === 'https:',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  log('info', request_id, { event: 'login.ok', username });
  return c.redirect('/admin/robots');
});

adminAuth.post('/logout', (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.redirect('/admin/login');
});
