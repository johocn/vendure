-- 远距离订单 RKXVG5CPL9DZ1GLB 的库存流水（验证 fallback 落点）
SELECT
    sm.id, sm.type, sm.quantity, sm."stockLocationId" AS loc_id, sl.name AS loc_name,
    sm."createdAt", sm."orderLineId", o.code AS order_code, pv.sku
FROM stock_movement sm
JOIN order_line ol ON ol.id = sm."orderLineId"
JOIN "order" o ON o.id = ol."orderId"
JOIN product_variant pv ON pv.id = sm."productVariantId"
LEFT JOIN stock_location sl ON sl.id = sm."stockLocationId"
WHERE o.code IN ('8PW6QEXLDHKRGJHR', 'RKXVG5CPL9DZ1GLB')
ORDER BY o.id, sm.id;
