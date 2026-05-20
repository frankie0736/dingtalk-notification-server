/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppVariables, Env, Robot } from '../../env';
import { encrypt } from '../../lib/crypto';
import { robotId } from '../../lib/id';
import { generateToken, hashToken, tokenPrefix } from '../../lib/token';
import { log } from '../../lib/log';
import {
  disableRobot,
  enableRobot,
  deleteRobot,
  insertRobot,
  listRobots,
  rotateRobotToken,
  getRobot,
} from '../../db/robots';
import { Layout } from '../../ui/layout';

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const adminRobots = new Hono<AppEnv>();

const CreateBody = z.object({
  name: z.string().min(1).max(100),
  webhook_url: z.string().url().startsWith('https://oapi.dingtalk.com/'),
  secret: z.string().min(8).max(200),
});

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function RobotsPage(props: {
  username: string;
  robots: Robot[];
  flash?: { kind: 'ok' | 'err'; msg: string };
  newToken?: { id: string; token: string };
}) {
  return (
    <Layout title="Robots" username={props.username}>
      <h2>Robots</h2>

      {props.flash ? (
        <div class={props.flash.kind === 'ok' ? 'alert alert-ok' : 'alert alert-err'}>
          {props.flash.msg}
        </div>
      ) : null}

      {props.newToken ? (
        <section>
          <h3>Token created for {props.newToken.id}</h3>
          <div class="token-once">
            <p>
              <strong>Save this token now — it will not be shown again.</strong>
            </p>
            <code>{props.newToken.token}</code>
          </div>
          <p class="muted" style="margin-top:12px;">
            Use this as <code>Authorization: Bearer {props.newToken.token}</code> when calling{' '}
            <code>POST /api/v1/notify</code>.
          </p>
        </section>
      ) : null}

      <section>
        <h3>Add robot</h3>
        <form method="post" action="/admin/robots">
          <div class="row">
            <div>
              <label for="name">Name</label>
              <input id="name" name="name" type="text" placeholder="prod-alerts" required />
            </div>
            <div style="flex: 2;">
              <label for="webhook_url">Webhook URL</label>
              <input
                id="webhook_url"
                name="webhook_url"
                type="url"
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                required
              />
            </div>
            <div style="flex: 2;">
              <label for="secret">Signing Secret</label>
              <input
                id="secret"
                name="secret"
                type="text"
                placeholder="SECxxxxxxxxxxxx"
                required
              />
            </div>
            <div style="flex: 0;">
              <button class="btn btn-primary" type="submit">
                Create
              </button>
            </div>
          </div>
        </form>
      </section>

      <section>
        <h3>All robots ({props.robots.length})</h3>
        {props.robots.length === 0 ? (
          <div class="empty">No robots yet. Create one above.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Token prefix</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.robots.map((r) => (
                <tr>
                  <td class="mono">{r.id}</td>
                  <td>{r.name}</td>
                  <td class="mono">{r.token_prefix}…</td>
                  <td class="muted">{fmtTime(r.created_at)}</td>
                  <td>
                    {r.disabled_at ? (
                      <span class="tag tag-muted">disabled</span>
                    ) : (
                      <span class="tag tag-ok">active</span>
                    )}
                  </td>
                  <td>
                    <form class="inline" method="post" action={`/admin/robots/${r.id}/rotate`}>
                      <button
                        class="btn btn-sm"
                        type="submit"
                        onclick="return confirm('Rotate token? The current token will stop working immediately.');"
                      >
                        Rotate
                      </button>
                    </form>{' '}
                    {r.disabled_at ? (
                      <form class="inline" method="post" action={`/admin/robots/${r.id}/enable`}>
                        <button class="btn btn-sm" type="submit">
                          Enable
                        </button>
                      </form>
                    ) : (
                      <form class="inline" method="post" action={`/admin/robots/${r.id}/disable`}>
                        <button class="btn btn-sm" type="submit">
                          Disable
                        </button>
                      </form>
                    )}{' '}
                    <form class="inline" method="post" action={`/admin/robots/${r.id}/delete`}>
                      <button
                        class="btn btn-sm btn-danger"
                        type="submit"
                        onclick="return confirm('Permanently delete this robot? Audit logs will remain.');"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Layout>
  );
}

adminRobots.get('/', async (c) => {
  const admin = c.get('admin');
  const robots = await listRobots(c.env.DB);
  return c.html(<RobotsPage username={admin?.username ?? ''} robots={robots} />);
});

adminRobots.post('/', async (c) => {
  const admin = c.get('admin');
  const request_id = c.get('request_id');
  const form = await c.req.parseBody();
  const parsed = CreateBody.safeParse({
    name: form.name,
    webhook_url: form.webhook_url,
    secret: form.secret,
  });

  if (!parsed.success) {
    const robots = await listRobots(c.env.DB);
    return c.html(
      <RobotsPage
        username={admin?.username ?? ''}
        robots={robots}
        flash={{ kind: 'err', msg: 'Validation failed: ' + parsed.error.issues.map((i) => i.message).join('; ') }}
      />
    );
  }

  const id = robotId();
  const token = generateToken();
  const [webhook_enc, secret_enc, token_hash] = await Promise.all([
    encrypt(c.env.MASTER_KEY, parsed.data.webhook_url),
    encrypt(c.env.MASTER_KEY, parsed.data.secret),
    hashToken(token),
  ]);

  await insertRobot(c.env.DB, {
    id,
    name: parsed.data.name,
    webhook_enc,
    secret_enc,
    token_hash,
    token_prefix: tokenPrefix(token),
  });

  log('info', request_id, { event: 'robot.created', robot_id: id, name: parsed.data.name });

  const robots = await listRobots(c.env.DB);
  return c.html(
    <RobotsPage
      username={admin?.username ?? ''}
      robots={robots}
      newToken={{ id, token }}
    />
  );
});

adminRobots.post('/:id/rotate', async (c) => {
  const admin = c.get('admin');
  const request_id = c.get('request_id');
  const id = c.req.param('id');
  const r = await getRobot(c.env.DB, id);
  if (!r) {
    return c.html(
      <RobotsPage
        username={admin?.username ?? ''}
        robots={await listRobots(c.env.DB)}
        flash={{ kind: 'err', msg: `Robot ${id} not found` }}
      />,
      404
    );
  }
  const token = generateToken();
  const token_hash = await hashToken(token);
  await rotateRobotToken(c.env.DB, id, token_hash, tokenPrefix(token));
  log('info', request_id, { event: 'robot.rotated', robot_id: id });

  const robots = await listRobots(c.env.DB);
  return c.html(
    <RobotsPage
      username={admin?.username ?? ''}
      robots={robots}
      newToken={{ id, token }}
      flash={{ kind: 'ok', msg: `Token rotated for ${id}` }}
    />
  );
});

adminRobots.post('/:id/disable', async (c) => {
  const id = c.req.param('id');
  await disableRobot(c.env.DB, id);
  log('info', c.get('request_id'), { event: 'robot.disabled', robot_id: id });
  return c.redirect('/admin/robots');
});

adminRobots.post('/:id/enable', async (c) => {
  const id = c.req.param('id');
  await enableRobot(c.env.DB, id);
  log('info', c.get('request_id'), { event: 'robot.enabled', robot_id: id });
  return c.redirect('/admin/robots');
});

adminRobots.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await deleteRobot(c.env.DB, id);
  log('info', c.get('request_id'), { event: 'robot.deleted', robot_id: id });
  return c.redirect('/admin/robots');
});
