/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';

type LayoutProps = {
  title: string;
  username?: string;
  children: unknown;
};

const css = `
:root {
  --bg: #0d1117;
  --panel: #161b22;
  --panel-2: #1f242c;
  --border: #30363d;
  --text: #e6edf3;
  --muted: #8b949e;
  --accent: #2f81f7;
  --ok: #3fb950;
  --warn: #d29922;
  --err: #f85149;
  --code-bg: #0d1117;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg); color: var(--text);
  line-height: 1.5;
  font-size: 14px;
}
header {
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
  display: flex; justify-content: space-between; align-items: center;
  background: var(--panel);
}
header h1 { margin: 0; font-size: 16px; font-weight: 600; }
header nav a { color: var(--text); text-decoration: none; margin-right: 16px; padding: 4px 8px; border-radius: 4px; }
header nav a:hover { background: var(--panel-2); }
header .meta { color: var(--muted); font-size: 12px; }
header .meta a { color: var(--accent); margin-left: 12px; text-decoration: none; }
main { max-width: 1200px; margin: 0 auto; padding: 24px; }
h2 { margin-top: 0; font-size: 18px; }
h3 { font-size: 15px; margin: 16px 0 8px; }
section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 500; }
tbody tr:hover { background: var(--panel-2); }
.btn {
  display: inline-block; padding: 6px 14px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--panel-2); color: var(--text);
  cursor: pointer; font-size: 13px; text-decoration: none;
  font-family: inherit;
}
.btn:hover { background: var(--border); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
.btn-primary:hover { background: #1f6feb; }
.btn-danger { background: var(--err); border-color: var(--err); color: white; }
.btn-danger:hover { background: #c62828; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
input, textarea, select {
  width: 100%; padding: 8px 12px;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  font-family: inherit; font-size: 13px;
}
input:focus, textarea:focus { outline: none; border-color: var(--accent); }
textarea { font-family: ui-monospace, SFMono-Regular, monospace; min-height: 80px; }
label { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; }
.row { display: flex; gap: 16px; align-items: end; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 140px; }
.field { margin-bottom: 14px; }
.muted { color: var(--muted); }
.mono { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; }
.tag-ok { background: rgba(63,185,80,0.15); color: var(--ok); }
.tag-warn { background: rgba(210,153,34,0.15); color: var(--warn); }
.tag-err { background: rgba(248,81,73,0.15); color: var(--err); }
.tag-muted { background: var(--panel-2); color: var(--muted); }
pre { background: var(--code-bg); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; border: 1px solid var(--border); }
code { font-family: ui-monospace, SFMono-Regular, monospace; }
.alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid; }
.alert-err { background: rgba(248,81,73,0.1); border-color: var(--err); color: var(--err); }
.alert-ok  { background: rgba(63,185,80,0.1); border-color: var(--ok); color: var(--ok); }
.token-once { background: rgba(210,153,34,0.1); border: 1px dashed var(--warn); padding: 14px; border-radius: 6px; }
.token-once code { font-size: 14px; color: var(--warn); user-select: all; }
.login-wrap { max-width: 360px; margin: 80px auto; }
.empty { padding: 40px; text-align: center; color: var(--muted); }
.flex { display: flex; gap: 12px; align-items: center; }
.flex-end { justify-content: flex-end; }
.pagination { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 16px; }
.pagination a { color: var(--accent); text-decoration: none; padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border); }
.pagination a.disabled { color: var(--muted); border-color: var(--border); pointer-events: none; }
.pagination .current { color: var(--muted); }
details { margin-top: 8px; }
details summary { cursor: pointer; color: var(--accent); padding: 4px 0; }
form.inline { display: inline; }
`;

export const Layout: FC<LayoutProps> = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title} · DingTalk Notify</title>
      <style>{css}</style>
      <script src="https://unpkg.com/htmx.org@2.0.3" crossorigin="anonymous"></script>
    </head>
    <body>
      <header>
        <div class="flex">
          <h1>🔔 DingTalk Notify</h1>
          {props.username ? (
            <nav>
              <a href="/admin/robots">Robots</a>
              <a href="/admin/logs">Logs</a>
            </nav>
          ) : null}
        </div>
        {props.username ? (
          <div class="meta">
            {props.username}
            <a href="/api-doc">API Doc</a>
            <form class="inline" method="post" action="/admin/logout">
              <a href="#" onclick="this.closest('form').submit(); return false;">Logout</a>
            </form>
          </div>
        ) : (
          <div class="meta">
            <a href="/api-doc">API Doc</a>
          </div>
        )}
      </header>
      <main>{props.children}</main>
    </body>
  </html>
);
