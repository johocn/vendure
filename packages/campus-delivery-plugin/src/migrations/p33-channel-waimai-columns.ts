// P1 F11（2026-10-31）：补齐 Channel 店铺展示/营业时间 5 个自定义字段的物理列。
// 这些字段已在使用（否则生产配置读取会报错），但历史迁移未落 ADD COLUMN；新环境重建会缺列。
// 物理列名规则：customFields + 字段名首字母大写、其余小写（TypeORM 行为）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p33ChannelWaimaiColumnsSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaitags" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaimonthlysales" int;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimailogo" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaipromotext" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaibusinesshours" varchar;
`;

@Injectable()
export class P33ChannelWaimaiColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p33ChannelWaimaiColumnsSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P33ChannelWaimaiColumnsMigration] failed:', e?.message);
        }
    }
}
