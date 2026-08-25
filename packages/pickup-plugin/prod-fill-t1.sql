-- 幂等补齐 t1 租户（channel id=7）闭环前置数据（v2，permissions 为 text 逗号分隔）
BEGIN;

-- 1. zhao@163.com (user id=4) 绑定 t1-tenant-admin 角色 (role id=15)
INSERT INTO user_roles_role ("userId", "roleId")
SELECT 4, 15
WHERE NOT EXISTS (SELECT 1 FROM user_roles_role WHERE "userId"=4 AND "roleId"=15);

-- 2. role 15 (t1-tenant-admin) 补 ManageOwnShop 权限（myPickupOrders/claimPickupByShop 需要）
UPDATE role SET permissions = CASE
    WHEN permissions IS NULL OR permissions = '' THEN 'ManageOwnShop'
    WHEN position('ManageOwnShop' in permissions) = 0 THEN permissions || ',ManageOwnShop'
    ELSE permissions END
WHERE id=15;

-- 3. 创建 shop（administratorId=3 = zhao 的 administrator；channelId=7 = t1）
INSERT INTO shop ("createdAt","updatedAt",name,slug,status,"administratorId","channelId")
SELECT now(), now(), '新生', 'xinsheng', 'active', 3, 7
WHERE NOT EXISTS (SELECT 1 FROM shop WHERE "channelId"=7 AND "administratorId"=3);

-- 4. 商品归属：product 3 归 t1 shop（customFieldsShopid 为 int 列 = shop.id）
UPDATE product SET "customFieldsShopid" = (SELECT id FROM shop WHERE "channelId"=7 LIMIT 1)
WHERE id=3 AND "customFieldsShopid" IS NULL;

-- 5. product 3 关联 t1 channel
INSERT INTO product_channels_channel ("productId","channelId")
SELECT 3, 7
WHERE NOT EXISTS (SELECT 1 FROM product_channels_channel WHERE "productId"=3 AND "channelId"=7);

-- 6. variant 6 在 t1 channel 的价格（12900 分）
INSERT INTO product_variant_price ("createdAt","updatedAt","currencyCode","channelId",price,"variantId")
SELECT now(), now(), 'CNY', 7, 12900, 6
WHERE NOT EXISTS (SELECT 1 FROM product_variant_price WHERE "variantId"=6 AND "channelId"=7 AND "currencyCode"='CNY');

-- 7. t1 支付方式：固定聚合码收款（handler 已注册）
INSERT INTO payment_method ("createdAt","updatedAt",code,enabled,handler)
SELECT now(), now(), 'fixed-aggregate-collection', true, '{"code":"fixed-aggregate-collection","args":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM payment_method WHERE code='fixed-aggregate-collection');

INSERT INTO payment_method_channels_channel ("paymentMethodId","channelId")
SELECT pm.id, 7 FROM payment_method pm WHERE pm.code='fixed-aggregate-collection'
  AND NOT EXISTS (SELECT 1 FROM payment_method_channels_channel WHERE "paymentMethodId"=pm.id AND "channelId"=7);

INSERT INTO payment_method_translation ("createdAt","updatedAt","languageCode",name,description,"baseId")
SELECT now(), now(), 'zh_Hans', '固定聚合码收款', '门店到店收银：顾客扫门店固定聚合收款码付款到商户，店员确认到账后完成交易', pm.id
FROM payment_method pm WHERE pm.code='fixed-aggregate-collection'
  AND NOT EXISTS (SELECT 1 FROM payment_method_translation WHERE "baseId"=pm.id AND "languageCode"='zh_Hans');

-- 8. t1 配送方式：门店自提（复用 store-pickup id=1）
INSERT INTO shipping_method_channels_channel ("shippingMethodId","channelId")
SELECT 1, 7
WHERE NOT EXISTS (SELECT 1 FROM shipping_method_channels_channel WHERE "shippingMethodId"=1 AND "channelId"=7);

-- 9. t1 channel 默认税率区/配送区（缺则下单报 active tax zone 无法确定）
UPDATE channel SET "defaultTaxZoneId"=1, "defaultShippingZoneId"=1
WHERE id=7 AND ("defaultTaxZoneId" IS NULL OR "defaultShippingZoneId" IS NULL);

-- 10. 库存地点 1（长春）关联 t1 channel（MultiChannelStockLocationStrategy 要求库存地点关联激活渠道）
--    注意：channelIds 缓存 TTL 7 天，改完需 pm2 restart vendure 清内存缓存
INSERT INTO stock_location_channels_channel ("stockLocationId","channelId")
SELECT 1, 7
WHERE NOT EXISTS (SELECT 1 FROM stock_location_channels_channel WHERE "stockLocationId"=1 AND "channelId"=7);

-- 11. variant 6 关联 t1 channel（addItemToOrder 要求 variant 在激活渠道可见/可售）
INSERT INTO product_variant_channels_channel ("productVariantId","channelId")
SELECT 6, 7
WHERE NOT EXISTS (SELECT 1 FROM product_variant_channels_channel WHERE "productVariantId"=6 AND "channelId"=7);

COMMIT;

\echo '=== 校验 ==='
SELECT ur."userId", ur."roleId", r.code FROM user_roles_role ur JOIN role r ON r.id=ur."roleId" WHERE ur."userId"=4;
SELECT id, code, position('ManageOwnShop' in permissions) AS has_manage_own_shop FROM role WHERE id=15;
SELECT id, name, slug, status, "administratorId", "channelId" FROM shop;
SELECT id, "customFieldsShopid" FROM product WHERE id=3;
SELECT "productId","channelId" FROM product_channels_channel WHERE "productId"=3;
SELECT "variantId","channelId",price FROM product_variant_price WHERE "variantId"=6;
SELECT id, code, enabled FROM payment_method WHERE code='fixed-aggregate-collection';
SELECT "paymentMethodId","channelId" FROM payment_method_channels_channel WHERE "channelId"=7;
SELECT "shippingMethodId","channelId" FROM shipping_method_channels_channel WHERE "channelId"=7;
