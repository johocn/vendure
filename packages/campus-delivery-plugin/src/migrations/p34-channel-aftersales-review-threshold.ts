// F11 补漏（2026-10-31 静态差集检查发现）：Channel.waimaiAfterSalesReviewThreshold（大额退款二次复核阈值）
// 历史上只在开发环境随 schema 同步建列，迁移目录缺失；新环境/灾备重建会缺列。
// 物理列名规则：customFields + 字段名首字母大写、其余小写（TypeORM 行为）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p34ChannelAfterSalesReviewThresholdSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesreviewthreshold" int;
`;

@Injectable()
export class P34ChannelAfterSalesReviewThresholdMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p34ChannelAfterSalesReviewThresholdSql
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
            console.error('[P34ChannelAfterSalesReviewThresholdMigration] failed:', e?.message);
        }
    }
}
