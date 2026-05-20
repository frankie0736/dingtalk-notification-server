// AES-GCM encrypt/decrypt for at-rest secret storage.
// Master key: base64 of 32 random bytes, stored in env.MASTER_KEY.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: CryptoKey | null = null;
let cachedKeyMaterial: string | null = null;

async function getKey(masterKey: string): Promise<CryptoKey> {
  if (cachedKey && cachedKeyMaterial === masterKey) return cachedKey;
  const raw = b64decode(masterKey);
  if (raw.length !== 32) {
    throw new Error(`MASTER_KEY must decode to 32 bytes (got ${raw.length})`);
  }
  cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  cachedKeyMaterial = masterKey;
  return cachedKey;
}

// Returns base64(iv || ciphertext).
export async function encrypt(masterKey: string, plaintext: string): Promise<string> {
  const key = await getKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);
  return b64encode(blob);
}

export async function decrypt(masterKey: string, blob: string): Promise<string> {
  const key = await getKey(masterKey);
  const buf = b64decode(blob);
  if (buf.length < 13) throw new Error('ciphertext too short');
  const iv = buf.subarray(0, 12);
  const ct = buf.subarray(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv } as AesGcmParams, key, ct as BufferSource);
  return dec.decode(pt);
}
