-- P1 F11：Channel 店铺展示字段缺列补齐（幂等，可重复执行）
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaitags" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaimonthlysales" int;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimailogo" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaipromotext" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaibusinesshours" varchar;
