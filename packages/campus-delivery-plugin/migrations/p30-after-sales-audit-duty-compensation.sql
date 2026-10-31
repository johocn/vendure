-- §100（2026-10-31）生产环境迁移：售后操作审计留痕 + 值班排班 + 补偿挽留方案
-- 对应插件迁移：packages/campus-delivery-plugin/src/migrations/p30-after-sales-audit-duty-compensation.ts
--
-- 使用说明：
--   1) 生产 DB_SYNC=0，插件启动时虽会自动执行同一段 SQL，但为避免启动期异常，
--      建议重启应用前先在目标库手工执行本脚本。
--   2) 全部语句均为 IF NOT EXISTS，可重复执行，不会覆盖已有数据。
--   3) 仅适用于 PostgreSQL。执行方式：psql -h <host> -U <user> -d <db> -f p30-after-sales-audit-duty-compensation.sql
--
-- 回滚（如确需撤销，注意会丢失数据）：
--   DROP TABLE IF EXISTS campus_after_sales_compensation_plan;
--   DROP TABLE IF EXISTS campus_after_sales_duty;
--   DROP TABLE IF EXISTS campus_after_sales_audit_log;

BEGIN;

-- 售后操作审计日志：审批/拒绝/关闭/转交/指派/暂停与恢复 SLA/升级/风险标记/
-- 退货换货/退款重试/线下退款/退款复核/补偿发放等动作统一落库
CREATE TABLE IF NOT EXISTS campus_after_sales_audit_log (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  action varchar(32) NOT NULL,
  "actorUserId" integer,
  "actorName" varchar(100),
  detail varchar(500)
);

-- 按售后单检索时间线
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_request
  ON campus_after_sales_audit_log ("channelId", "requestId", "createdAt");

-- 按店铺 + 时间区间检索 / 按处理人、动作筛选用
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_channel
  ON campus_after_sales_audit_log ("channelId", "createdAt");

-- 值班排班表：weekday 0=周日，startMin/endMin 为当天分钟数，endMin>1440 表示跨零点
CREATE TABLE IF NOT EXISTS campus_after_sales_duty (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  weekday smallint NOT NULL,
  "startMin" integer NOT NULL,
  "endMin" integer NOT NULL,
  "userId" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_duty_unique
  ON campus_after_sales_duty ("channelId", weekday, "startMin", "endMin", "userId");

CREATE INDEX IF NOT EXISTS campus_after_sales_duty_channel
  ON campus_after_sales_duty ("channelId", weekday, "startMin");

-- 补偿挽留方案：预设档位，一键发放 部分退款 + 优惠券
CREATE TABLE IF NOT EXISTS campus_after_sales_compensation_plan (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  name varchar(100) NOT NULL,
  "refundAmount" integer NOT NULL DEFAULT 0,
  "couponTemplateId" varchar(255),
  note varchar(200),
  enabled boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS campus_after_sales_compensation_plan_channel
  ON campus_after_sales_compensation_plan ("channelId", enabled);

COMMIT;

-- 执行后校验（预期返回三张表、8 个索引）：
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('campus_after_sales_audit_log',
--                       'campus_after_sales_duty',
--                       'campus_after_sales_compensation_plan')
--  ORDER BY table_name;
--
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename IN ('campus_after_sales_audit_log',
--                      'campus_after_sales_duty',
--                      'campus_after_sales_compensation_plan')
--  ORDER BY indexname;
