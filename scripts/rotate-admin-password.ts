#!/usr/bin/env bun
// Rotate the admin password in one command:
//   1. hash the new password with PBKDF2
//   2. rewrite ADMIN_PASS_HASH in .prod.vars
//   3. push the updated secret to Cloudflare
//
// Usage: bun --silent run rotate-admin-password '<new-password>'
//   (The --silent flag is critical — without it `bun run` echoes the
//    script command including the password to stdout.)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hashPassword } from '../src/lib/password';

const PROD_VARS_PATH = '.prod.vars';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: bun --silent run rotate-admin-password <new-password>');
  process.exit(1);
}
if (pw.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

if (!existsSync(PROD_VARS_PATH)) {
  console.error(`${PROD_VARS_PATH} not found.`);
  process.exit(1);
}

console.log('→ hashing password (PBKDF2-SHA256)...');
const hash = await hashPassword(pw);

console.log(`→ updating ${PROD_VARS_PATH}`);
const original = readFileSync(PROD_VARS_PATH, 'utf8');
const updated = original.replace(
  /^ADMIN_PASS_HASH\s*=.*$/m,
  `ADMIN_PASS_HASH="${hash}"`
);
if (updated === original) {
  // No existing line — append.
  writeFileSync(PROD_VARS_PATH, original.replace(/\s*$/, '') + `\nADMIN_PASS_HASH="${hash}"\n`);
} else {
  writeFileSync(PROD_VARS_PATH, updated);
}

console.log('→ pushing ADMIN_PASS_HASH to Cloudflare\n');
// Direct script call (not `bun run …`) so the secret never appears in any
// Bun lifecycle-script echo line.
const r = spawnSync('bun', ['scripts/push-secrets.ts'], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
