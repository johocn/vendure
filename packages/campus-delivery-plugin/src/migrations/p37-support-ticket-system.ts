// R7 外部运单异常转工单：工单支持系统来源与幂等键；系统工单无顾客（customerId 可空）。
// 同时补订单 customFields.exceptionResolvedAt 物理列（工单关闭后回写，调度不再重复告警）。
// 物理列名规则：自定义字段 = customFields + 首字母大写 + 其余小写。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p37SupportTicketSystemSql = `
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
`;

@Injectable()
export class P37SupportTicketSystemMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p37SupportTicketSystemSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P37SupportTicketSystemMigration] failed:', e?.message);
        }
    }
}
