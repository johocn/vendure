SELECT sl.id AS loc_id, sl.name AS loc_name, pv.sku, slt."stockOnHand", slt."stockAllocated"
FROM stock_level slt
JOIN stock_location sl ON sl.id = slt."stockLocationId"
JOIN product_variant pv ON pv.id = slt."productVariantId"
WHERE pv.sku = 'SB-6-BLK'
ORDER BY sl.id;
