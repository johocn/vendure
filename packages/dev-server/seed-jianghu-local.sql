-- ============================================================
-- 校园江湖 · 本地开发数据播种（仅限本地 Postgres，勿用于生产）
-- ------------------------------------------------------------
-- 背景：江湖玩法要求 ① 有进行中的事件、② 大厅有可接任务、③ 玩家是已审核骑手。
--      生产上这三项由 admin API（jianghuCreateEvent / jianghuCreateTask）与骑手
--      入驻审核产生；本地缺 superadmin 凭据时，用本脚本直接种数据即可联调。
--
-- 用法：
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -U postgres -d vendure -f seed-jianghu-local.sql
--
-- 幂等：已存在则跳过，可重复执行。
-- 回滚：
--   UPDATE customer SET "customFieldsRiderstatus" = NULL WHERE "emailAddress" = 'jianghu-e2e@local.test';
--   DELETE FROM jianghu_task WHERE title LIKE '送信·%' AND "plainText" = '本地播种任务';
--   DELETE FROM jianghu_event WHERE name = '书院异动·本地联调';
-- ============================================================

-- 1) 测试账号开通骑手身份（玩法前置条件：riderStatus === 'APPROVED'）
UPDATE customer
   SET "customFieldsRiderstatus" = 'APPROVED',
       "customFieldsRidercampus" = COALESCE("customFieldsRidercampus", 'demo-campus')
 WHERE "emailAddress" = 'jianghu-e2e@local.test';

-- 2) 播种一个进行中的多人拼图事件（幂等：无事件才插入）
INSERT INTO jianghu_event (name, "desc", total, collected, "perPersonLimit", "endAt", "rewardPoolRep")
SELECT '书院异动·本地联调',
       '本地播种事件：六条线索散落各处，由四名以上传信者分头搜集。集齐后解锁完整故事，参与者均分声望池。',
       6, 0, 3,
       to_char(now() + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
       300
 WHERE NOT EXISTS (SELECT 1 FROM jianghu_event);

-- 3) 播种大厅可接任务（幂等：没有 OPEN 任务才插入）
INSERT INTO jianghu_task ("type", level, title, brief, "plainText", "campusCode", "rewardRep", "rewardIntel", "verifyMode", status)
SELECT 'LETTER', 'NORMAL', '送信·北门外', '把密信送到北门驿站，收信人会给你一句暗号。',
       '本地播种任务：暗号见 jianghuRefreshCode 返回。', 'demo-campus', 10, 0, 'CODE', 'OPEN'
 WHERE NOT EXISTS (SELECT 1 FROM jianghu_task WHERE status = 'OPEN');

-- 3b) 联调复位：上次联调接走/核销掉的本地播种任务重新开放，保证可重复跑闭环
--     （仅作用于本脚本播种的任务，按 plainText 识别，不影响其他数据）
UPDATE jianghu_task
   SET status = 'OPEN', "takenByCustomerId" = NULL, "takenAt" = NULL, "verifyCode" = NULL,
       "codeExpireAt" = NULL, "tryCount" = 0
 WHERE "plainText" = '本地播种任务：暗号见 jianghuRefreshCode 返回。';

-- 5) 本地「运营审核」：把本地提交的待审情报/线索放行，让情报市场与线索墙也有数据
--     仅作用于 demo-campus 的本地数据（对应 admin 的 jianghuAuditIntel / jianghuAuditClue 效果）
UPDATE jianghu_intel SET status = 'APPROVED' WHERE status = 'PENDING' AND "campusCode" = 'demo-campus';
UPDATE jianghu_clue SET status = 'SHOWN' WHERE status = 'PENDING' AND "campusCode" = 'demo-campus';

-- 6) 按实际上墙线索数校正事件进度（避免手工改状态导致进度对不上）
UPDATE jianghu_event e
   SET collected = (SELECT count(*) FROM jianghu_clue c
                     WHERE c."eventId" = e.id::varchar AND c.status = 'SHOWN');

-- 7) 结果自检
SELECT 'events' AS 项, count(*) AS 数量 FROM jianghu_event
UNION ALL
SELECT 'open_tasks', count(*) FROM jianghu_task WHERE status = 'OPEN'
UNION ALL
SELECT 'rider_approved', count(*) FROM customer WHERE "emailAddress" = 'jianghu-e2e@local.test' AND "customFieldsRiderstatus" = 'APPROVED'
UNION ALL
SELECT 'intel_approved', count(*) FROM jianghu_intel WHERE status = 'APPROVED'
UNION ALL
SELECT 'clue_shown', count(*) FROM jianghu_clue WHERE status = 'SHOWN';
