/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import type { AppVariables, Env, NotifyLog } from '../../env';
import { getLog, listLogs, type LogListItem } from '../../db/logs';
import { listRobots } from '../../db/robots';
import { Layout } from '../../ui/layout';

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const adminLogs = new Hono<AppEnv>();

const PAGE_SIZE = 50;

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function statusTag(errcode: number | null, http_status: number | null) {
  if (errcode === 0) return <span class="tag tag-ok">ok</span>;
  if (errcode === null && http_status === null) return <span class="tag tag-err">network</span>;
  return <span class="tag tag-err">err{errcode !== null ? `:${errcode}` : ''}</span>;
}

adminLogs.get('/', async (c) => {
  const admin = c.get('admin');
  const robot_id = c.req.query('robot_id') ?? undefined;
  const okFilter = c.req.query('ok');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ items, total }, robots] = await Promise.all([
    listLogs(c.env.DB, {
      robot_id,
      ok: okFilter === 'true' ? true : okFilter === 'false' ? false : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    listRobots(c.env.DB),
  ]);

  const robotsById = new Map(robots.map((r) => [r.id, r]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return c.html(
    <Layout title="Logs" username={admin?.username ?? ''}>
      <h2>Audit logs</h2>

      <section>
        <form method="get" action="/admin/logs">
          <div class="row">
            <div>
              <label for="robot_id">Robot</label>
              <select id="robot_id" name="robot_id">
                <option value="" selected={!robot_id}>
                  All
                </option>
                {robots.map((r) => (
                  <option value={r.id} selected={robot_id === r.id}>
                    {r.name} ({r.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label for="ok">Status</label>
              <select id="ok" name="ok">
                <option value="" selected={!okFilter}>
                  All
                </option>
                <option value="true" selected={okFilter === 'true'}>
                  OK only
                </option>
                <option value="false" selected={okFilter === 'false'}>
                  Errors only
                </option>
              </select>
            </div>
            <div style="flex: 0;">
              <button class="btn btn-primary" type="submit">
                Filter
              </button>
            </div>
            <div style="flex: 0;">
              <a class="btn" href="/admin/logs">
                Reset
              </a>
            </div>
          </div>
        </form>
      </section>

      <section>
        <h3>
          {total} record{total === 1 ? '' : 's'} · page {page}/{totalPages}
        </h3>
        {items.length === 0 ? (
          <div class="empty">No matching logs.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Robot</th>
                <th>Type</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Caller</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((l: LogListItem) => (
                <tr>
                  <td class="muted mono">{fmtTime(l.created_at)}</td>
                  <td>{robotsById.get(l.robot_id)?.name ?? l.robot_id}</td>
                  <td>
                    <span class="tag tag-muted">{l.msg_type}</span>
                  </td>
                  <td>{statusTag(l.dingtalk_errcode, l.http_status)}</td>
                  <td class="muted">{l.latency_ms ?? '—'}ms</td>
                  <td class="muted mono">{l.caller_ip ?? '—'}</td>
                  <td>
                    <a class="btn btn-sm" href={`/admin/logs/${l.id}`}>
                      Detail
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 ? (
          <div class="pagination">
            <a
              class={page > 1 ? '' : 'disabled'}
              href={`/admin/logs?page=${page - 1}${robot_id ? `&robot_id=${robot_id}` : ''}${okFilter ? `&ok=${okFilter}` : ''}`}
            >
              ← Prev
            </a>
            <span class="current">
              {page} / {totalPages}
            </span>
            <a
              class={page < totalPages ? '' : 'disabled'}
              href={`/admin/logs?page=${page + 1}${robot_id ? `&robot_id=${robot_id}` : ''}${okFilter ? `&ok=${okFilter}` : ''}`}
            >
              Next →
            </a>
          </div>
        ) : null}
      </section>
    </Layout>
  );
});

function LogDetail(props: { log: NotifyLog; robotName: string }) {
  const l = props.log;
  let payloadPretty = l.request_payload;
  try {
    payloadPretty = JSON.stringify(JSON.parse(l.request_payload), null, 2);
  } catch {}
  let dtPretty = l.dingtalk_body ?? '';
  try {
    dtPretty = JSON.stringify(JSON.parse(l.dingtalk_body ?? ''), null, 2);
  } catch {}

  return (
    <Layout title={`Log ${l.id}`} username="">
      <p>
        <a href="/admin/logs">← Back to logs</a>
      </p>
      <section>
        <h2>{l.id}</h2>
        <table>
          <tbody>
            <tr>
              <th>Time</th>
              <td class="mono">{fmtTime(l.created_at)}</td>
            </tr>
            <tr>
              <th>Robot</th>
              <td>
                {props.robotName} <span class="muted mono">({l.robot_id})</span>
              </td>
            </tr>
            <tr>
              <th>Type</th>
              <td>
                <span class="tag tag-muted">{l.msg_type}</span>
              </td>
            </tr>
            <tr>
              <th>Caller</th>
              <td class="mono">
                {l.caller_ip ?? '—'} <span class="muted">· {l.caller_ua ?? '—'}</span>
              </td>
            </tr>
            <tr>
              <th>@ mobiles</th>
              <td class="mono">{l.at_mobiles ?? '—'}</td>
            </tr>
            <tr>
              <th>@ all</th>
              <td>{l.at_all ? 'yes' : 'no'}</td>
            </tr>
            <tr>
              <th>HTTP status</th>
              <td>{l.http_status ?? 'network_error'}</td>
            </tr>
            <tr>
              <th>DingTalk errcode</th>
              <td>{l.dingtalk_errcode ?? '—'}</td>
            </tr>
            <tr>
              <th>DingTalk errmsg</th>
              <td>{l.dingtalk_errmsg ?? '—'}</td>
            </tr>
            <tr>
              <th>Latency</th>
              <td>{l.latency_ms ?? '—'}ms</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>Request payload (as received)</h3>
        <pre>
          <code>{payloadPretty}</code>
        </pre>
      </section>

      <section>
        <h3>Body sent to DingTalk</h3>
        <pre>
          <code>{dtPretty}</code>
        </pre>
      </section>
    </Layout>
  );
}

adminLogs.get('/:id', async (c) => {
  const id = c.req.param('id');
  const l = await getLog(c.env.DB, id);
  if (!l) {
    return c.html(
      <Layout title="Not found" username={c.get('admin')?.username ?? ''}>
        <section>
          <h2>Log not found</h2>
          <p>
            <a href="/admin/logs">← Back to logs</a>
          </p>
        </section>
      </Layout>,
      404
    );
  }
  const robots = await listRobots(c.env.DB);
  const robotName = robots.find((r) => r.id === l.robot_id)?.name ?? l.robot_id;
  return c.html(<LogDetail log={l} robotName={robotName} />);
});
