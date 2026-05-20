// Signed cookie session for the single admin user.
// Cookie value: base64url(json) + '.' + base64url(HMAC-SHA256(SESSION_SECRET, json))

const enc = new TextEncoder();
const dec = new TextDecoder();

export const COOKIE_NAME = 'dnk_admin';
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type Payload = {
  u: string;
  exp: number; // ms epoch
};

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data as BufferSource));
}

async function hmacVerify(secret: string, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const expected = await hmac(secret, data);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ sig[i];
  return diff === 0;
}

export async function createSession(secret: string, username: string): Promise<string> {
  const payload: Payload = {
    u: username,
    exp: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
  };
  const json = JSON.stringify(payload);
  const payloadBytes = enc.encode(json);
  const payloadB64 = b64urlEncode(payloadBytes);
  const sig = await hmac(secret, payloadBytes);
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export async function verifySession(
  secret: string,
  cookie: string | undefined
): Promise<{ username: string } | null> {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const payloadBytes = b64urlDecode(parts[0]);
  const sig = b64urlDecode(parts[1]);
  if (!(await hmacVerify(secret, payloadBytes, sig))) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(dec.decode(payloadBytes)) as Payload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
  if (Date.now() > payload.exp) return null;
  return { username: payload.u };
}

export function buildSessionCookie(value: string, isSecure: boolean): string {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export function buildClearCookie(isSecure: boolean): string {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}
