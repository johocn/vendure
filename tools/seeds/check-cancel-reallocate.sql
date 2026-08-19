-- 检查订单5/6 的订单行、stockMovement 库存流水、以及 cancelOrder 是否重新分配
SELECT o.id, o.code, o.state,
       ol.id AS line_id, ol.quantity,
       pv.sku, ol."stockLocationId" AS line_loc_id, ol."stockLevelId" AS line_level_id
FROM "order" o
JOIN order_line ol ON ol."orderId" = o.id
JOIN product_variant pv ON pv.id = ol."productVariantId"
WHERE o.id IN (5,6)
ORDER BY o.id, ol.id;