// Bearer token: 'dnk_' + 32 random base32 chars (~160 bits entropy).
// Lookup is by sha256(token), so DB never sees plaintext.

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function generateToken(): string {
  // 32 base32 chars × 5 bits = 160 bits of entropy.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += ALPHABET[bytes[i] % 32];
  }
  return 'dnk_' + s;
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return b64(new Uint8Array(buf));
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 8);
}
