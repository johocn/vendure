// P15（2026-10-29）：工单与售后打通——工单落关联订单主键与售后单主键。
// 历史工单两列为 null（不回填：orderCode 为自由文本，无法可靠反解订单）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p15SupportTicketAfterSalesSql = `
ALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS "orderId" int;
ALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS "afterSalesRequestId" int;
CREATE INDEX IF NOT EXISTS idx_campus_support_ticket_aftersales ON campus_support_ticket ("afterSalesRequestId");
`;

@Injectable()
export class P15SupportTicketAfterSalesMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p15SupportTicketAfterSalesSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P15SupportTicketAfterSalesMigration] failed:', e?.message);
        }
    }
}
