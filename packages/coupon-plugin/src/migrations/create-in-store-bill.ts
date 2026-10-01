// 确保 in_store_bill 表存在（生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，
// 故此 migration 幂等建表；表/索引均 IF NOT EXISTS，出错只打日志不抛错，不阻塞启动，
// 等待下次启动重试）。列类型对齐实体：channelId 为 bigint，时间列 timestamptz，
// 金额列 integer（分），createdAt/updatedAt 默认 now()。
// id 自增写法 SQLite 与 PostgreSQL 不同（AUTOINCREMENT / SERIAL），按 driver 分支生成。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class CreateInStoreBillMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('InStoreBill');
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
                        "channelId" bigint NOT NULL,
                        "customerCouponId" integer NOT NULL,
                        "couponCode" varchar(255) NOT NULL,
                        "couponTemplateId" integer NOT NULL,
                        "couponName" varchar(255) NULL,
                        "customerId" integer NOT NULL,
                        "customerName" varchar(255) NULL,
                        "customerPhone" varchar(255) NULL,
                        "discountType" varchar(255) NOT NULL,
                        "discountValue" integer NOT NULL,
                        "originalAmount" integer NOT NULL,
                        "discountAmount" integer NOT NULL,
                        "finalAmount" integer NOT NULL,
                        "operatorId" integer NOT NULL,
                        "operatorName" varchar(255) NULL,
                        "remark" varchar(255) NULL,
                        "billedAt" datetime NOT NULL
                    )`
                    : `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" SERIAL PRIMARY KEY,
                        "createdAt" timestamptz NOT NULL DEFAULT now(),
                        "updatedAt" timestamptz NOT NULL DEFAULT now(),
                        "channelId" bigint NOT NULL,
                        "customerCouponId" integer NOT NULL,
                        "couponCode" varchar(255) NOT NULL,
                        "couponTemplateId" integer NOT NULL,
                        "couponName" varchar(255) NULL,
                        "customerId" integer NOT NULL,
                        "customerName" varchar(255) NULL,
                        "customerPhone" varchar(255) NULL,
                        "discountType" varchar(255) NOT NULL,
                        "discountValue" integer NOT NULL,
                        "originalAmount" integer NOT NULL,
                        "discountAmount" integer NOT NULL,
                        "finalAmount" integer NOT NULL,
                        "operatorId" integer NOT NULL,
                        "operatorName" varchar(255) NULL,
                        "remark" varchar(255) NULL,
                        "billedAt" timestamptz NOT NULL
                    )`;
                await queryRunner.query(createTableSql);
                // 券码查询、顾客查询、租户+时间维度查询三个索引（幂等）
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_in_store_bill_code ON "${tableName}" ("couponCode")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_in_store_bill_customer ON "${tableName}" ("customerId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_in_store_bill_channel_time ON "${tableName}" ("channelId", "billedAt")`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateInStoreBillMigration] failed to ensure table:', e?.message);
        }
    }
}
