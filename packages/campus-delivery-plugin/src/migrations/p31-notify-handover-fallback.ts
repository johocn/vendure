// §4/§5（2026-10-31）：用户侧新增两个通知触点模板字段。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p31NotifyHandoverFallbackSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateArrivedHandover" varchar;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateDeliveryFallback" varchar;
`;

@Injectable()
export class P31NotifyHandoverFallbackMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p31NotifyHandoverFallbackSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P31NotifyHandoverFallbackMigration] failed:', e?.message);
        }
    }
}
