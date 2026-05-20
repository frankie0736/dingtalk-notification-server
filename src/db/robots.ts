import type { Robot } from '../env';

export type RobotInsert = {
  id: string;
  name: string;
  webhook_enc: string;
  secret_enc: string;
  token_hash: string;
  token_prefix: string;
};

export async function insertRobot(db: D1Database, r: RobotInsert): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO robot (id, name, webhook_enc, secret_enc, token_hash, token_prefix, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(r.id, r.name, r.webhook_enc, r.secret_enc, r.token_hash, r.token_prefix, now)
    .run();
}

export async function findRobotByTokenHash(db: D1Database, tokenHash: string): Promise<Robot | null> {
  const row = await db
    .prepare(`SELECT * FROM robot WHERE token_hash = ? AND disabled_at IS NULL LIMIT 1`)
    .bind(tokenHash)
    .first<Robot>();
  return row ?? null;
}

export async function listRobots(db: D1Database): Promise<Robot[]> {
  const res = await db
    .prepare(`SELECT * FROM robot ORDER BY created_at DESC`)
    .all<Robot>();
  return res.results ?? [];
}

export async function getRobot(db: D1Database, id: string): Promise<Robot | null> {
  const row = await db.prepare(`SELECT * FROM robot WHERE id = ? LIMIT 1`).bind(id).first<Robot>();
  return row ?? null;
}

export async function rotateRobotToken(
  db: D1Database,
  id: string,
  token_hash: string,
  token_prefix: string
): Promise<void> {
  await db
    .prepare(`UPDATE robot SET token_hash = ?, token_prefix = ? WHERE id = ?`)
    .bind(token_hash, token_prefix, id)
    .run();
}

export async function disableRobot(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE robot SET disabled_at = ? WHERE id = ? AND disabled_at IS NULL`)
    .bind(Date.now(), id)
    .run();
}

export async function enableRobot(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE robot SET disabled_at = NULL WHERE id = ?`).bind(id).run();
}

export async function deleteRobot(db: D1Database, id: string): Promise<void> {
  // Hard delete; logs keep robot_id reference (no FK cascade — historical truth).
  await db.prepare(`DELETE FROM robot WHERE id = ?`).bind(id).run();
}
