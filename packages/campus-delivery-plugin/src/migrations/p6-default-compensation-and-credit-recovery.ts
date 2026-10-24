// P6 运营默认值 + 骑手信用自动恢复（2026-10-24）
// - 超时赔付默认开（entity default 已改 true；这里把已有 false 行也翻成 true）
// - 缺券模板时 sweepTimeoutCompensation 已有限频告警（L796-804）
// - 骑手信用自动恢复由 RiderCreditService.sweepRecovery() 实现（每轮 dispatch sweep 调用）
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p6DefaultCompensationSql = `
-- 超时赔付默认开：entity default 已改 true，这里把已有 FALSE 行翻成 TRUE
-- 缺券模板时 sweepTimeoutCompensation 会限频告警，不会实际赔付
UPDATE campus_fulfillment_config
SET "timeoutCompensationEnabled" = TRUE
WHERE "timeoutCompensationEnabled" = FALSE;
`;

@Injectable()
export class P6DefaultCompensationMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                await qr.query(p6DefaultCompensationSql);
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P6DefaultCompensationMigration] failed:', e?.message);
        }
    }
}
