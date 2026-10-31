-- R2 补偿任务表（券/站内信失败落库 + 定时退避重试）
CREATE TABLE IF NOT EXISTS campus_compensation_task (
    id serial PRIMARY KEY,
    "orderId" int NOT NULL,
    "channelId" int NOT NULL,
    "customerId" int,
    kind varchar NOT NULL,
    payload text,
    "dedupeKey" varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'pending',
    attempts int NOT NULL DEFAULT 0,
    "nextAttemptAt" timestamp,
    "lastError" varchar,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campus_compensation_dedupe" ON campus_compensation_task ("dedupeKey");
CREATE INDEX IF NOT EXISTS "IDX_campus_compensation_due" ON campus_compensation_task (status, "nextAttemptAt");
