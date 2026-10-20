// 确保 coupon_settlement_reconcile_diff 表存在（T5 对账差异表，对标 create-coupon-settlement 迁移模式）：
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，幂等建表 + 幂等索引。
// 出错只打日志不抛错，不阻塞启动，等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class CreateCouponReconcileMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponSettlementReconcileDiff');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const type = this.connection.driver.options.type;
                const isSqlite = type === 'sqljs' || type === 'better-sqlite3' || type === 'sqlite';
                const createTableSql = isSqlite
                    ? `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" integer PRIMARY KEY AUTOINCREMENT,
                        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
                        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
                        "runId" varchar(255) NOT NULL,
                        "channelId" bigint NOT NULL,
                        "settlementOrderId" integer NULL,
                        "settlementNo" varchar(255) NULL,
                        "diffType" varchar(255) NOT NULL,
                        "severity" varchar(255) NOT NULL,
                        "detail" text NULL,
                        "resolvedAt" datetime NULL,
                        "remark" varchar(255) NULL
                    )`
                    : `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" SERIAL PRIMARY KEY,
                        "createdAt" timestamptz NOT NULL DEFAULT now(),
                        "updatedAt" timestamptz NOT NULL DEFAULT now(),
                        "runId" varchar(255) NOT NULL,
                        "channelId" bigint NOT NULL,
                        "settlementOrderId" integer NULL,
                        "settlementNo" varchar(255) NULL,
                        "diffType" varchar(255) NOT NULL,
                        "severity" varchar(255) NOT NULL,
                        "detail" text NULL,
                        "resolvedAt" timestamptz NULL,
                        "remark" varchar(255) NULL
                    )`;
                await queryRunner.query(createTableSql);
                // 台账页查询路径：轮次（最新一轮）与严重度过滤（幂等）
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_reconcile_channel_run ON "${tableName}" ("channelId", "runId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_reconcile_channel_severity ON "${tableName}" ("channelId", "severity")`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponReconcileMigration] failed to ensure table:', e?.message);
        }
    }
}
