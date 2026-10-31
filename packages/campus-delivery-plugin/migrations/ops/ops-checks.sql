-- R8 遗留巡检（只读）：生产可直接执行，任何一项非 0 都需要人工跟进
-- 用法：docker exec -i 1Panel-postgresql-pIe0 psql -U youshaop -d vendure -f -  <<'SQL'
-- 注意：全部为 SELECT，不会修改数据；时间均为库内 now()（UTC）

-- 1) 提现扣款意图滞留（>10 分钟说明 R1 对账任务未生效或扣款链路异常）
SELECT 'withdraw_intent_stale' AS metric, COUNT(*)::int AS n
FROM rider_withdrawal_request
WHERE "withdrawState" = 'intent' AND "createdAt" < now() - interval '10 minutes';

-- 2) 退款失败待人工（调度墙应同时有告警）
SELECT 'refund_failed' AS metric, COUNT(*)::int AS n
FROM "order" WHERE "customFieldsHallstatus" = 'refund_failed';

-- 3) 外部运力异常（长期停留需转工单/人工改派）
SELECT 'third_party_exception' AS metric, COUNT(*)::int AS n
FROM "order" WHERE "customFieldsThirdpartystate" = 'exception';

-- 4) 补偿任务失败 / 超期未执行
SELECT 'compensation_failed' AS metric, COUNT(*)::int AS n
FROM campus_compensation_task WHERE status = 'failed';
SELECT 'compensation_pending_overdue' AS metric, COUNT(*)::int AS n
FROM campus_compensation_task
WHERE status = 'pending' AND "nextAttemptAt" < now() - interval '30 minutes';

-- 5) 锁位容量偏差（profiled per active slot；>0 = 容量多计，<0 = 容量少计）
SELECT s.id AS slot_id, s."slotDate" AS slot_date, s."lockedCount" AS locked,
       COALESCE(o.n, 0) AS active_orders,
       s."lockedCount" - COALESCE(o.n, 0) AS drift
FROM delivery_slot s
LEFT JOIN (
    SELECT "customFieldsDeliveryslotid"::text AS slot_id, COUNT(*)::int AS n
    FROM "order"
    WHERE "customFieldsSlotlocked" = true
      AND COALESCE("customFieldsHallstatus", '') NOT IN
          ('delivered', 'cancelled', 'exception_final', 'no_rider_final', 'refund_failed')
    GROUP BY 1
) o ON o.slot_id = s.id::text
WHERE s.active = true AND s."slotDate" >= CURRENT_DATE
ORDER BY ABS(s."lockedCount" - COALESCE(o.n, 0)) DESC;
