-- 清理 D3 回归产生的测试订单与账号（@joho.cn，保留 e2e-coupon@joho.cn 截图账号）
BEGIN;

-- 1. 收集测试订单 id 列表（临时表）
CREATE TEMP TABLE tmp_test_orders AS
SELECT o.id, o.code FROM "order" o
JOIN customer c ON c.id = o."customerId"
WHERE c."emailAddress" LIKE '%@joho.cn';

-- 2. 先删 orderLineId 间接表（它们引用 order_line，必须先于 order_line 删除）
DO $$
DECLARE tbl text; oid integer;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name='orderLineId' AND table_schema='public'
      AND data_type='integer'
  LOOP
    EXECUTE format('DELETE FROM %I WHERE "orderLineId" IN (SELECT ol.id FROM order_line ol JOIN tmp_test_orders t ON t.id=ol."orderId")', tbl);
  END LOOP;
  -- 再删 integer orderId 直接引用表（此时 order_line 已无 orderLineId 引用）
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name='orderId' AND table_schema='public'
      AND data_type='integer'
  LOOP
    EXECUTE format('DELETE FROM %I WHERE "orderId" IN (SELECT id FROM tmp_test_orders)', tbl);
  END LOOP;
  -- 删除 order 本体（先清 session 对 order 的引用）
  FOR oid IN SELECT id FROM tmp_test_orders LOOP
    EXECUTE format('DELETE FROM session WHERE "activeOrderId"=%L', oid);
    EXECUTE format('DELETE FROM "order" WHERE id=%L', oid);
  END LOOP;
END $$;

-- 3. varchar FK 表：按 order code 删
DELETE FROM commission_record WHERE "orderId" IN (SELECT code FROM tmp_test_orders);
DELETE FROM delivery_record WHERE "orderId" IN (SELECT code FROM tmp_test_orders);
DELETE FROM group_buy_order WHERE "orderId" IN (SELECT code FROM tmp_test_orders);
DELETE FROM marketplace_inventory_ledger WHERE "orderId" IN (SELECT code FROM tmp_test_orders);
DELETE FROM merchant_settlement_ledger WHERE "orderId" IN (SELECT code FROM tmp_test_orders);
DELETE FROM reconciliation_order_line WHERE "orderId" IN (SELECT code FROM tmp_test_orders);

DROP TABLE tmp_test_orders;

-- 4. 删除回归测试账号（customer + 关联 user / authentication_method / session / customer_coupon）
CREATE TEMP TABLE tmp_test_users AS
  SELECT u.id FROM "user" u
  JOIN customer c ON c."userId" = u.id
  WHERE c."emailAddress" LIKE '%@joho.cn';
DELETE FROM session WHERE "userId" IN (SELECT id FROM tmp_test_users);
DELETE FROM authentication_method WHERE "userId" IN (SELECT id FROM tmp_test_users);
DELETE FROM customer_coupon WHERE "customerId" IN (
  SELECT c.id FROM customer c WHERE c."emailAddress" LIKE '%@joho.cn'
);
-- 先删 customer（user 被 customer.userId 引用）
DELETE FROM customer WHERE "emailAddress" LIKE '%@joho.cn';
DELETE FROM "user" WHERE id IN (SELECT id FROM tmp_test_users);
DROP TABLE tmp_test_users;

COMMIT;

-- 5. 校验
SELECT '剩余 @joho.cn 测试账号' AS check_name, count(*) FROM customer WHERE "emailAddress" LIKE '%@joho.cn';
SELECT '剩余回归订单' AS check_name, count(*) FROM "order" o JOIN customer c ON c.id=o."customerId" WHERE c."emailAddress" LIKE '%@joho.cn';
