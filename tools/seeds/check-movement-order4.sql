-- 订单 FRU9X2ST3J6UAX7B 的库存流水（确认分配来源仓）
SELECT
    sm.id, sm.type, sm.quantity, sm."stockLocationId" AS loc_id, sl.name AS loc_name,
    sm."createdAt", sm."orderLineId", o.code AS order_code, pv.sku
FROM stock_movement sm
JOIN order_line ol ON ol.id = sm."orderLineId"
JOIN "order" o ON o.id = ol."orderId"
JOIN product_variant pv ON pv.id = sm."productVariantId"
LEFT JOIN stock_location sl ON sl.id = sm."stockLocationId"
WHERE o.code = 'FRU9X2ST3J6UAX7B'
ORDER BY sm.id;
