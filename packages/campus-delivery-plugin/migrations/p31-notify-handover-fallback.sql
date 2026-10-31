-- §4/§5（2026-10-31）生产环境迁移：用户侧新增两个通知触点模板字段
-- 对应插件迁移：packages/campus-delivery-plugin/src/migrations/p31-notify-handover-fallback.ts
--
-- 使用说明：
--   1) 生产 DB_SYNC=0，插件启动时虽会自动执行同一段 SQL，但为避免启动期异常，
--      建议重启应用前先在目标库手工执行本脚本。
--   2) 全部语句均为 IF NOT EXISTS，可重复执行，不会覆盖已有数据。
--   3) 仅适用于 PostgreSQL。执行方式：psql -h <host> -U <user> -d <db> -f p31-notify-handover-fallback.sql
--
-- 回滚（会丢失已配置的模板 ID，注意确认）：
--   ALTER TABLE campus_fulfillment_config DROP COLUMN IF EXISTS "notifyTemplateDeliveryFallback";
--   ALTER TABLE campus_fulfillment_config DROP COLUMN IF EXISTS "notifyTemplateArrivedHandover";

BEGIN;

-- 第一段交接完成：餐/包裹已到校园交接点（R1/R2/R3 均由传信者接力时触发）
ALTER TABLE campus_fulfillment_config
  ADD COLUMN IF NOT EXISTS "notifyTemplateArrivedHandover" varchar;

-- 配送方式降级/异常重派（超时转传信者、外部运力异常）
ALTER TABLE campus_fulfillment_config
  ADD COLUMN IF NOT EXISTS "notifyTemplateDeliveryFallback" varchar;

COMMIT;

-- 执行后校验（预期返回 2 行）：
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name = 'campus_fulfillment_config'
--    AND column_name IN ('notifyTemplateArrivedHandover', 'notifyTemplateDeliveryFallback')
--  ORDER BY column_name;
