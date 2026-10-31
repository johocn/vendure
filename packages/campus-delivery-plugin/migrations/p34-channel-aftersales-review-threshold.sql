-- F11 补漏（2026-10-31）：Channel 大额退款复核阈值列的物理列迁移。
-- 可重复执行（IF NOT EXISTS）。
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesreviewthreshold" int;
