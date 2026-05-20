export type Env = {
  DB: D1Database;
  MASTER_KEY: string;
  SESSION_SECRET: string;
  ADMIN_USER: string;
  ADMIN_PASS_HASH: string;
};

export type Robot = {
  id: string;
  name: string;
  webhook_enc: string;
  secret_enc: string;
  token_hash: string;
  token_prefix: string;
  created_at: number;
  disabled_at: number | null;
};

export type NotifyLog = {
  id: string;
  robot_id: string;
  caller_ip: string | null;
  caller_ua: string | null;
  msg_type: 'text' | 'markdown';
  at_mobiles: string | null;
  at_all: number;
  request_payload: string;
  dingtalk_body: string | null;
  http_status: number | null;
  dingtalk_errcode: number | null;
  dingtalk_errmsg: string | null;
  latency_ms: number | null;
  created_at: number;
};

export type AppVariables = {
  request_id: string;
  robot?: Robot;
  admin?: { username: string };
};
