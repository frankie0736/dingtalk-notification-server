-- DingTalk Notification Server — initial schema
-- One robot per webhook URL; one bearer token per robot.

CREATE TABLE robot (
  id            TEXT PRIMARY KEY,         -- 'rb_' + ulid suffix
  name          TEXT NOT NULL,            -- human label
  webhook_enc   TEXT NOT NULL,            -- AES-GCM(full DingTalk webhook URL incl. ?access_token=...)
  secret_enc    TEXT NOT NULL,            -- AES-GCM(signing secret)
  token_hash    TEXT UNIQUE NOT NULL,     -- sha256(bearer token)
  token_prefix  TEXT NOT NULL,            -- first 8 chars of plaintext token, UI display only
  created_at    INTEGER NOT NULL,         -- ms epoch
  disabled_at   INTEGER                   -- ms epoch; NULL = active
);

CREATE INDEX idx_robot_token_hash ON robot(token_hash);

CREATE TABLE notify_log (
  id                TEXT PRIMARY KEY,     -- 'lg_' + ulid
  robot_id          TEXT NOT NULL,
  caller_ip         TEXT,
  caller_ua         TEXT,
  msg_type          TEXT NOT NULL,        -- 'text' | 'markdown'
  at_mobiles        TEXT,                 -- JSON array string
  at_all            INTEGER NOT NULL DEFAULT 0,
  request_payload   TEXT NOT NULL,        -- raw incoming JSON
  dingtalk_body     TEXT,                 -- final body sent to DingTalk
  http_status       INTEGER,              -- HTTP status from DingTalk
  dingtalk_errcode  INTEGER,              -- errcode parsed from DingTalk body
  dingtalk_errmsg   TEXT,
  latency_ms        INTEGER,
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (robot_id) REFERENCES robot(id)
);

CREATE INDEX idx_notify_log_robot_time ON notify_log(robot_id, created_at DESC);
CREATE INDEX idx_notify_log_time       ON notify_log(created_at DESC);
