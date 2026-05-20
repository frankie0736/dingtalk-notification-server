#!/usr/bin/env bun
// Push all Worker secrets defined in .prod.vars to Cloudflare.
// Idempotent — run again any time you change a value in .prod.vars.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PROD_VARS_PATH = '.prod.vars';

// Only these keys are pushed as Worker secrets. CLOUDFLARE_ACCOUNT_ID is used
// to target the right account but is not itself a Worker secret.
const WORKER_SECRET_KEYS = ['MASTER_KEY', 'SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASS_HASH'] as const;

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!existsSync(PROD_VARS_PATH)) {
  die(`${PROD_VARS_PATH} not found. Copy .prod.vars.example to ${PROD_VARS_PATH} and fill in values.`);
}

const vars = parseDotenv(readFileSync(PROD_VARS_PATH, 'utf8'));
const accountId = vars.CLOUDFLARE_ACCOUNT_ID;
if (!accountId || accountId.startsWith('REPLACE_')) {
  die(`CLOUDFLARE_ACCOUNT_ID missing or unset in ${PROD_VARS_PATH}.`);
}

const missing = WORKER_SECRET_KEYS.filter((k) => !vars[k] || vars[k].startsWith('REPLACE_'));
if (missing.length > 0) {
  die(`Missing or unset in ${PROD_VARS_PATH}: ${missing.join(', ')}`);
}

console.log(`→ target account: ${accountId.slice(0, 8)}…`);
console.log(`→ pushing ${WORKER_SECRET_KEYS.length} secrets\n`);

let failed = 0;
for (const key of WORKER_SECRET_KEYS) {
  process.stdout.write(`  ${key.padEnd(18)} `);
  const r = spawnSync('bunx', ['wrangler', 'secret', 'put', key], {
    input: vars[key],
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId },
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (r.status === 0) {
    console.log('✓');
  } else {
    console.log('✗');
    console.error(r.stderr || r.stdout || '(no output)');
    failed++;
  }
}

if (failed === 0) {
  console.log('\n✓ all secrets pushed — live Worker picks them up immediately, no redeploy needed.');
  process.exit(0);
} else {
  console.error(`\n✗ ${failed} secret(s) failed to push.`);
  process.exit(1);
}
