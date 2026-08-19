-- 核对订单 FRU9X2ST3J6UAX7B 的库存分配记录
SELECT
    a.id AS allocation_id,
    a.stock_location_id,
    sl.name AS stock_location_name,
    a.quantity,
    a.created_at,
    oi.order_line_id,
    o.code AS order_code,
    o.state AS order_state,
    pv.sku
FROM allocation a
JOIN order_item oi ON oi.id = a.order_item_id
JOIN order_line ol ON ol.id = oi.order_line_id
JOIN "order" o ON o.id = ol.order_id
JOIN product_variant pv ON pv.id = oi.product_variant_id
JOIN stock_location sl ON sl.id = a.stock_location_id
WHERE o.code = 'FRU9X2ST3J6UAX7B';
