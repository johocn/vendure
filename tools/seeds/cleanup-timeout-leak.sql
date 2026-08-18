-- 修复历史脏数据：为已取消订单未释放的库存分配补发 RELEASE 流水，并回退 stockAllocated
-- 背景：修复 shouldAllocateStock 之前，订单5/6 的 RELEASE 被取消时的重新 ALLOCATION 抵消，订单4 有 2 笔分配从未释放，
--       导致 stock_level.stockAllocated 虚高（SB-6-BLK 长春仓虚高 4）。

BEGIN;

-- 1) 为每个净分配 > 0 的已取消订单行补发一笔 RELEASE（与创建 RELEASE 流水的字段对齐）
INSERT INTO stock_movement
    ("createdAt", "updatedAt", "type", "quantity", "stockLocationId", "discriminator",
     "productVariantId", "orderLineId", "customFieldsBusinessreason")
SELECT now(), now(), 'RELEASE', net.net_alloc, net."stockLocationId", 'Release',
       net."productVariantId", net."orderLineId", 'cleanup:timeout-leak'
FROM (
    SELECT ol.id AS "orderLineId",
           ol."productVariantId",
           (SELECT sl.id FROM stock_location sl
            JOIN stock_movement sm2 ON sm2."stockLocationId"=sl.id
            WHERE sm2."orderLineId"=ol.id
            GROUP BY sl.id
            ORDER BY sl.id
            LIMIT 1) AS "stockLocationId",
           SUM(CASE sm.type
                 WHEN 'ALLOCATION' THEN sm.quantity
                 WHEN 'RELEASE'    THEN -sm.quantity
                 ELSE 0 END
           ) AS net_alloc
    FROM "order" o
    JOIN order_line ol ON ol."orderId"=o.id
    LEFT JOIN stock_movement sm ON sm."orderLineId"=ol.id
    WHERE o.state = 'Cancelled'
    GROUP BY ol.id, ol."productVariantId"
    HAVING SUM(CASE sm.type
                 WHEN 'ALLOCATION' THEN sm.quantity
                 WHEN 'RELEASE'    THEN -sm.quantity
                 ELSE 0 END) > 0
) net;

-- 2) 同步将 stockAllocated 回退（按 自定义字段标识 汇总本次补发的释放量）
UPDATE stock_level sl
SET "stockAllocated" = GREATEST(0, sl."stockAllocated" - x.released),
    "updatedAt" = now()
FROM (
    SELECT sm."productVariantId", sm."stockLocationId", SUM(sm.quantity) AS released
    FROM stock_movement sm
    WHERE sm."customFieldsBusinessreason" = 'cleanup:timeout-leak'
    GROUP BY sm."productVariantId", sm."stockLocationId"
) x
WHERE sl."productVariantId"=x."productVariantId"
  AND sl."stockLocationId"=x."stockLocationId";

-- 3) 校验结果
\echo '=== 校验1：本次补发的 RELEASE ==='
SELECT id, type, quantity, "orderLineId", "productVariantId", "stockLocationId",
       "customFieldsBusinessreason"
FROM stock_movement WHERE "customFieldsBusinessreason"='cleanup:timeout-leak';

\echo '=== 校验2：净分配应全部归零 ==='
SELECT o.id AS order_id, o.code, o.state, ol.id AS line_id, pv.sku,
       SUM(CASE WHEN sm.type='ALLOCATION' THEN sm.quantity ELSE -sm.quantity END) AS net_alloc
FROM "order" o
JOIN order_line ol ON ol."orderId"=o.id
JOIN product_variant pv ON pv.id=ol."productVariantId"
LEFT JOIN stock_movement sm ON sm."orderLineId"=ol.id
WHERE o.state='Cancelled'
GROUP BY o.id, o.code, o.state, ol.id, pv.sku
ORDER BY o.id;

\echo '=== 校验3：库存水位（stockAllocated 应为 0） ==='
SELECT sl.id AS loc_id, sl.name AS loc_name, pv.sku,
       slv."stockOnHand", slv."stockAllocated"
FROM stock_level slv
JOIN stock_location sl ON sl.id=slv."stockLocationId"
JOIN product_variant pv ON pv.id=slv."productVariantId"
WHERE pv.sku='SB-6-BLK';

-- 事务收尾：若上面校验显示净分配归零且 stockAllocated 已回退，提交；否则本脚本应中断自行 rollback。
COMMIT;