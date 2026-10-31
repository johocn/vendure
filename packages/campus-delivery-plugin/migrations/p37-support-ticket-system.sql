-- R7 外部运单异常转工单：系统工单来源/幂等键 + 订单异常已处置标记
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'customer';
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "dedupeKey" varchar;
ALTER TABLE campus_support_ticket
    ALTER COLUMN "customerId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campus_support_ticket_dedupe"
    ON campus_support_ticket ("dedupeKey") WHERE "dedupeKey" IS NOT NULL;
ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS "customFieldsExceptionresolvedat" timestamptz;
