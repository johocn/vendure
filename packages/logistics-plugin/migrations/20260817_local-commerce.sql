-- =====================================================================
-- 本地电商「就近履约」数据库变更脚本
-- 插件：packages/logistics-plugin  (catalog-custom-fields.ts)
-- 说明：
--   线上 Vendure 依赖 synchronize:true，重启后 TypeORM 会自动为新增自定义字段建列，
--   因此本脚本在线上为"参考/备份"，保证关闭 synchronize 或手工部署时数据模型一致。
--   （synchronize 调整列类型时，最好手动运行本脚本代替自动变更。）
-- 约定：Vendure 自定义字段列名 = 字段名 snake_case，无前缀。
-- 幂等：基于 information_schema 判断，可重复执行。
-- =====================================================================

-- 1) Product: 归属城市 + 服务城市列表（超区提示 / 前端按城市过滤）
ALTER TABLE "product"
    ADD COLUMN IF NOT EXISTS "belong_city" VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS "service_cities" TEXT[] NULL;

-- 2) StockLocation: 门店/仓库经纬度 + 服务城市列表（就近算法 + 超区门禁输入）
ALTER TABLE "stock_location"
    ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS "service_cities" TEXT[] NULL;

-- 3) Order: 下单定位 + 服务城市 + 履约方式（就近分配输入）
ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS "city" VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS "delivery_type" VARCHAR(255) NULL DEFAULT 'delivery';