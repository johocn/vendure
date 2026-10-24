// P5 时区修复（2026-10-24）：order.customFields*At 列从 timestamp without time zone → timestamp with time zone。
// 历史数据写入用 JS new Date()（epoch-based = UTC），PG session timezone = UTC，
// 所以存量数据就是 UTC 墙钟时间，ALTER ... AT TIME ZONE 'UTC' 无偏移语义损失。
// 修复后 TypeORM/pg 客户端读回 Date 与写入 epoch ms 严格对齐，不再出现运维脚本造测试数据偏 8 小时。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

// 从 information_schema.columns 现拉：避免硬编码遗漏未来新增的 customFields datetime 列
const discoverSql = `
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='order'
  AND data_type='timestamp without time zone'
  AND column_name LIKE 'customFields%'
ORDER BY column_name
`;

const buildAlterSql = (cols: string[]): string => cols.map(
    c => `ALTER TABLE "order" ALTER COLUMN "${c}" TYPE timestamp with time zone USING "${c}" AT TIME ZONE 'UTC';`,
).join('\n');

@Injectable()
export class P5TimestampTimezoneMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const runner = this.connection.createQueryRunner();
        try {
            const rows = await runner.query(discoverSql);
            const cols: string[] = Array.isArray(rows)
                ? (rows as any[]).map(r => r.column_name).filter(Boolean)
                : [];
            if (!cols.length) {
                // 已经全部转完
                return;
            }
            const sql = buildAlterSql(cols);
            await runner.query(sql);
            // eslint-disable-next-line no-console
            console.log(`[P5Migration] timestamp with time zone: migrated ${cols.length} columns → timestamptz`);
        } catch (e: any) {
            // 启动早期 migration 跑失败不阻断应用（Vendure synchronize 会兜底）
            // eslint-disable-next-line no-console
            console.warn(`[P5Migration] skipped: ${e?.message ?? e}`);
        } finally {
            await runner.release();
        }
    }
}
