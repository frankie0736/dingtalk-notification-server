// DingTalk custom robot signing + send.
// Reference: https://open.dingtalk.com/document/robots/customize-robot-security-settings
//
//   timestamp    = Date.now() in ms (string)
//   stringToSign = `${timestamp}\n${secret}`
//   sign         = urlEncode(base64(HMAC_SHA256(secret, stringToSign)))
//   finalURL     = `${webhook}&timestamp=${timestamp}&sign=${sign}`

const enc = new TextEncoder();

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export async function sign(secret: string, timestamp: string): Promise<string> {
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign)));
  return encodeURIComponent(b64encode(sig));
}

export async function buildSignedUrl(webhook: string, secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const s = await sign(secret, timestamp);
  const sep = webhook.includes('?') ? '&' : '?';
  return `${webhook}${sep}timestamp=${timestamp}&sign=${s}`;
}

export type DingTalkResponse = {
  errcode: number;
  errmsg: string;
};

export type SendResult = {
  http_status: number;
  errcode: number | null;
  errmsg: string | null;
  raw_body: string;
};

export async function send(
  webhook: string,
  secret: string,
  body: unknown,
  signal?: AbortSignal
): Promise<SendResult> {
  const url = await buildSignedUrl(webhook, secret);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal,
  });
  const text = await resp.text();
  let errcode: number | null = null;
  let errmsg: string | null = null;
  try {
    const parsed = JSON.parse(text) as Partial<DingTalkResponse>;
    if (typeof parsed.errcode === 'number') errcode = parsed.errcode;
    if (typeof parsed.errmsg === 'string') errmsg = parsed.errmsg;
  } catch {
    // non-JSON body — leave nulls; raw_body has the truth
  }
  return { http_status: resp.status, errcode, errmsg, raw_body: text };
}

// Build the body DingTalk expects from our normalized API shape.
//
// Important: only `text` triggers a real @-mention push notification (blue badge +
// device alert). `markdown` will show the recipient's name inline but does NOT
// deliver a push — see the README for the recommended two-step pattern.
export function buildDingTalkBody(input: {
  type: 'text' | 'markdown';
  content: string;
  title?: string;
  at_mobiles?: string[];
  at_all?: boolean;
}): Record<string, unknown> {
  const at = {
    atMobiles: input.at_mobiles ?? [],
    isAtAll: input.at_all === true,
  };

  if (input.type === 'text') {
    return {
      msgtype: 'text',
      text: { content: input.content },
      at,
    };
  }

  // markdown: DingTalk requires `@<mobile>` literals in the body so it can
  // substitute the recipient's display name. This is purely visual — it does
  // NOT trigger a push notification. Trailing space matters for the substitution
  // to fire at all.
  const trailingMentions =
    input.at_mobiles && input.at_mobiles.length > 0
      ? '\n\n' + input.at_mobiles.map((m) => `@${m} `).join('')
      : '';

  return {
    msgtype: 'markdown',
    markdown: {
      title: input.title ?? 'Notification',
      text: input.content + trailingMentions,
    },
    at,
  };
}
