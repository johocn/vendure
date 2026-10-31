-- R1 提现原子化：提现申请新增扣款对账状态
-- intent=已落库未确认扣款 / confirmed=扣款已确认 / deduct_failed=扣款失败自动作废
-- 历史行为 NULL 或默认 confirmed（旧流程先扣款后落库）
ALTER TABLE rider_withdrawal_request
    ADD COLUMN IF NOT EXISTS "withdrawState" varchar DEFAULT 'confirmed';
