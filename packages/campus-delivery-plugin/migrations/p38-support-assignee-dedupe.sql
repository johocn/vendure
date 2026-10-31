-- G3 系统工单自动指派值班人：工单增加 assigneeId（管理员 userId）。
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "assigneeId" int;
CREATE INDEX IF NOT EXISTS "IDX_campus_support_ticket_assignee"
    ON campus_support_ticket ("assigneeId") WHERE "assigneeId" IS NOT NULL;

-- M4 跨实例去重/限频：key 主键，expiresAt 到期时间，counter 计数，value JSON。
CREATE TABLE IF NOT EXISTS campus_dedupe_key (
    "key" varchar PRIMARY KEY,
    "expiresAt" timestamptz NOT NULL,
    counter int NOT NULL DEFAULT 0,
    value jsonb
);
CREATE INDEX IF NOT EXISTS "IDX_campus_dedupe_key_expires"
    ON campus_dedupe_key ("expiresAt");
