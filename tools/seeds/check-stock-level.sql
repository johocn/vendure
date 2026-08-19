-- 核对 variant 4 (SB-6-BLK) 各仓库存水位
SELECT sl.id AS loc_id, sl.name AS loc_name, pv.sku, ls."stockOnHand", ls."stockAllocated"
FROM stock_level ls
JOIN stock_location sl ON sl.id = ls."stockLocationId"
JOIN product_variant pv ON pv.id = ls."productVariantId"
WHERE pv.id = 4
ORDER BY sl.id;
