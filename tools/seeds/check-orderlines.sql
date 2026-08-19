SELECT ol.id AS line_id, o.code AS order_code, o.state AS order_state,
       ol.state AS line_state, pv.sku, ol.quantity, ol."orderPlacedQuantity", ol."cancelledQuantity"
FROM order_line ol
JOIN "order" o ON o.id = ol."orderId"
JOIN product_variant pv ON pv.id = ol."productVariantId"
WHERE o.id IN (4,5,6)
ORDER BY ol.id;
