-- 基线：SB-6-BLK 全部库存流水
SELECT sm.id, sm.type, sm.quantity, sl.name AS loc_name, sm."createdAt", o.id AS oid, o.code AS order_code, o.state AS order_state
FROM stock_movement sm
LEFT JOIN order_line ol ON ol.id = sm."orderLineId"
LEFT JOIN "order" o ON o.id = ol."orderId"
LEFT JOIN stock_location sl ON sl.id = sm."stockLocationId"
WHERE sm."productVariantId" = (SELECT id FROM product_variant WHERE sku='SB-6-BLK')
ORDER BY sm.id;
