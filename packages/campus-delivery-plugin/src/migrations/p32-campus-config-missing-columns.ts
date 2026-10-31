// P1 F11（2026-10-31）：补齐配置表历史遗漏列 + 公告列扩容。
// 生产 synchronize:false，这些列靠手工 SQL 存在；新环境/灾备重建时缺列会让配置查询直接报
// column does not exist。迁移幂等（IF NOT EXISTS / 加宽安全），随服务启动执行。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p32CampusConfigMissingColumnsSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "freeShippingThreshold" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationEnabled" boolean DEFAULT true;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutGraceMinutes" int DEFAULT 10;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationCouponTemplateId" varchar;
ALTER TABLE campus_fulfillment_config ALTER COLUMN "storeNotice" TYPE varchar(500);
`;

@Injectable()
export class P32CampusConfigMissingColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p32CampusConfigMissingColumnsSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P32CampusConfigMissingColumnsMigration] failed:', e?.message);
        }
    }
}
