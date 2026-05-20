import type { NotifyLog } from '../env';

export type NotifyLogInsert = {
  id: string;
  robot_id: string;
  caller_ip: string | null;
  caller_ua: string | null;
  msg_type: 'text' | 'markdown';
  at_mobiles: string[] | null;
  at_all: boolean;
  request_payload: string;
  dingtalk_body: string | null;
  http_status: number | null;
  dingtalk_errcode: number | null;
  dingtalk_errmsg: string | null;
  latency_ms: number | null;
};

export async function insertLog(db: D1Database, l: NotifyLogInsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notify_log
       (id, robot_id, caller_ip, caller_ua, msg_type, at_mobiles, at_all,
        request_payload, dingtalk_body, http_status, dingtalk_errcode, dingtalk_errmsg,
        latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      l.id,
      l.robot_id,
      l.caller_ip,
      l.caller_ua,
      l.msg_type,
      l.at_mobiles ? JSON.stringify(l.at_mobiles) : null,
      l.at_all ? 1 : 0,
      l.request_payload,
      l.dingtalk_body,
      l.http_status,
      l.dingtalk_errcode,
      l.dingtalk_errmsg,
      l.latency_ms,
      Date.now()
    )
    .run();
}

export type LogFilter = {
  robot_id?: string;
  from?: number;
  to?: number;
  ok?: boolean; // true → errcode = 0; false → errcode != 0
  limit: number;
  offset: number;
};

export type LogListItem = Pick<
  NotifyLog,
  | 'id'
  | 'robot_id'
  | 'msg_type'
  | 'caller_ip'
  | 'http_status'
  | 'dingtalk_errcode'
  | 'dingtalk_errmsg'
  | 'latency_ms'
  | 'created_at'
>;

export async function listLogs(
  db: D1Database,
  f: LogFilter
): Promise<{ items: LogListItem[]; total: number }> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.robot_id) {
    where.push('robot_id = ?');
    args.push(f.robot_id);
  }
  if (typeof f.from === 'number') {
    where.push('created_at >= ?');
    args.push(f.from);
  }
  if (typeof f.to === 'number') {
    where.push('created_at <= ?');
    args.push(f.to);
  }
  if (f.ok === true) {
    where.push('dingtalk_errcode = 0');
  } else if (f.ok === false) {
    where.push('(dingtalk_errcode IS NULL OR dingtalk_errcode != 0)');
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM notify_log ${whereSql}`)
    .bind(...args)
    .first<{ c: number }>();
  const total = totalRow?.c ?? 0;

  const res = await db
    .prepare(
      `SELECT id, robot_id, msg_type, caller_ip, http_status, dingtalk_errcode,
              dingtalk_errmsg, latency_ms, created_at
         FROM notify_log
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
    )
    .bind(...args, f.limit, f.offset)
    .all<LogListItem>();

  return { items: res.results ?? [], total };
}

export async function getLog(db: D1Database, id: string): Promise<NotifyLog | null> {
  const row = await db
    .prepare(`SELECT * FROM notify_log WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<NotifyLog>();
  return row ?? null;
}
