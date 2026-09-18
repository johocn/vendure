// 确保 product_coupon_binding 表存在（生产 PostgreSQL 与本地开发 SQLite 都可能关闭
// synchronize，故此 migration 幂等地建表；表/索引均 IF NOT EXISTS，出错只打日志不抛错，
// 不阻塞启动，等待下次启动重试）。列类型对齐实体：variantIds 用 text 存 JSON 序列化，
// channelId 为 bigint，时间列 timestamptz，createdAt/updatedAt 默认 now()。
// id 自增写法 SQLite 与 PostgreSQL 不同（AUTOINCREMENT / SERIAL），按 driver 分支生成。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class CreateProductCouponBindingMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('ProductCouponBinding');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const type = this.connection.driver.options.type;
                const createTableSql =
                    type === 'sqlite' || type === 'better-sqlite3'
                        ? `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" integer PRIMARY KEY AUTOINCREMENT,
                        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
                        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
                        "productId" integer NOT NULL,
                        "variantIds" text NULL,
                        "couponTemplateId" integer NOT NULL,
                        "enabled" boolean NOT NULL DEFAULT 1,
                        "channelId" bigint NULL,
                        "displayOrder" integer NOT NULL DEFAULT 0,
                        "perUserClaimLimit" integer NULL,
                        "claimWindowStart" datetime NULL,
                        "claimWindowEnd" datetime NULL,
                        "claimStock" integer NULL,
                        "badgeText" varchar(255) NULL,
                        "promoTitle" varchar(255) NULL,
                        "remark" varchar(255) NULL
                    )`
                        : `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" SERIAL PRIMARY KEY,
                        "createdAt" timestamptz NOT NULL DEFAULT now(),
                        "updatedAt" timestamptz NOT NULL DEFAULT now(),
                        "productId" integer NOT NULL,
                        "variantIds" text NULL,
                        "couponTemplateId" integer NOT NULL,
                        "enabled" boolean NOT NULL DEFAULT true,
                        "channelId" bigint NULL,
                        "displayOrder" integer NOT NULL DEFAULT 0,
                        "perUserClaimLimit" integer NULL,
                        "claimWindowStart" timestamptz NULL,
                        "claimWindowEnd" timestamptz NULL,
                        "claimStock" integer NULL,
                        "badgeText" varchar(255) NULL,
                        "promoTitle" varchar(255) NULL,
                        "remark" varchar(255) NULL
                    )`;
                await queryRunner.query(createTableSql);
                // 商品+租户维度、券模板维度两个查询索引（幂等）
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_binding_product ON "${tableName}" ("productId", "channelId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_binding_template ON "${tableName}" ("couponTemplateId")`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateProductCouponBindingMigration] failed to ensure table:', e?.message);
        }
    }
}
