// Crockford base32 ulid. 26 chars: 10 chars (48 bits ms) + 16 chars (80 bits random).
// Monotonic-ish: not strict, fine for log ids.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = 32;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let out = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    out = ENCODING[now % ENCODING_LEN] + out;
    now = Math.floor(now / ENCODING_LEN);
  }
  return out;
}

function encodeRandom(): string {
  const buf = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    out += ENCODING[buf[i] % ENCODING_LEN];
  }
  return out;
}

export function ulid(): string {
  return encodeTime(Date.now()) + encodeRandom();
}

export function robotId(): string {
  return 'rb_' + ulid().slice(0, 12).toLowerCase();
}

export function logId(): string {
  return 'lg_' + ulid().toLowerCase();
}

export function requestId(): string {
  return 'rq_' + ulid().slice(0, 12).toLowerCase();
}
