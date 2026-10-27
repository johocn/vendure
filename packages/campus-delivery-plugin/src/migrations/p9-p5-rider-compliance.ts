// P2-5 批次（2026-10-27）：骑手合规资料列（健康证 / 保险 / 背景调查）。
// Customer 自定义字段为物理列（命名规则：customFields + 首字母大写+其余小写），
// 生产 synchronize 若被 DB_SYNC=0 关闭时靠此处幂等补列；IF NOT EXISTS 重复启动安全。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P5RiderComplianceSql = `
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertno" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertimg" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertexpiry" timestamp;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderinsuranceno" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderinsuranceexpiry" timestamp;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderbackgroundcheck" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderbackgroundcheckat" timestamp
`;

@Injectable()
export class P9P5RiderComplianceMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P5RiderComplianceSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P5RiderComplianceMigration] failed:', e?.message);
        }
    }
}