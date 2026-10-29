// §69 商家自动接单（2026-10-29）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** 履约配置 4 个自动接单字段（simple-json 路线列存 text）+ Order.autoAcceptedAt 留痕列 */
export const p13AutoAcceptSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptDelaySeconds" int NOT NULL DEFAULT 30;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptDailyLimit" int NOT NULL DEFAULT 0;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptRoutes" text NOT NULL DEFAULT '["R1","R2","R3"]';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsAutoacceptedat" timestamp;
`;

@Injectable()
export class P13AutoAcceptMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p13AutoAcceptSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            console.error('[P13AutoAcceptMigration] failed:', e?.message);
        }
    }
}
