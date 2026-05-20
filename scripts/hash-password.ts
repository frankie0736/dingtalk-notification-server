#!/usr/bin/env bun
// Hash a password for the ADMIN_PASS_HASH secret.
// Usage: bun run hash-password 'mypassword'

import { hashPassword } from '../src/lib/password';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: bun run hash-password <password>');
  process.exit(1);
}

const encoded = await hashPassword(pw);
console.log(encoded);
console.error('');
console.error('Set this as the ADMIN_PASS_HASH secret:');
console.error('  Locally:  add to .dev.vars');
console.error('  Remote:   wrangler secret put ADMIN_PASS_HASH');
