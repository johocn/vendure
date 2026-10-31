-- P1 F11：配置表缺列补齐 + 店铺公告列扩容（幂等，可重复执行）
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "freeShippingThreshold" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationEnabled" boolean DEFAULT true;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutGraceMinutes" int DEFAULT 10;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationCouponTemplateId" varchar;
ALTER TABLE campus_fulfillment_config ALTER COLUMN "storeNotice" TYPE varchar(500);
