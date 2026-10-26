// 券 ↔ 门店打通：幂等建 coupon_store_binding / coupon_redemption 两表，
// 并补 coupon_template.storeCoverage、coupon_sale_order.storeId/storeSnapshot、
// customer_coupon.redeemedStoreId 四类列（共 4 列）。
// 参照 create-coupon-sale.ts / create-coupon-settlement.ts 范式：生产 PostgreSQL 与本地 SQLite
// 都可能关闭 synchronize，故按 driver 分支建表、索引 IF NOT EXISTS、列 hasColumn 幂等判断；
// 失败只打日志不抛错，不阻塞启动，等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, QueryRunner, TableColumn } from 'typeorm';

@Injectable()
export class CreateCouponStoreMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const type = this.connection.driver.options.type;
                const isSqlite = type === 'sqljs' || type === 'better-sqlite3' || type === 'sqlite';

                const idColumn = isSqlite
                    ? '"id" integer PRIMARY KEY AUTOINCREMENT'
                    : '"id" SERIAL PRIMARY KEY';
                const createdAt = isSqlite
                    ? `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))`
                    : '"createdAt" timestamptz NOT NULL DEFAULT now()';
                const updatedAt = isSqlite
                    ? `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))`
                    : '"updatedAt" timestamptz NOT NULL DEFAULT now()';
                const dateType = isSqlite ? 'datetime' : 'timestamptz';
                const boolDefault = isSqlite ? 0 : 'false';

                // 1) 券模板 ↔ 门店绑定
                const bindingTable = 'coupon_store_binding';
                if (!(await queryRunner.hasTable(bindingTable))) {
                    await queryRunner.query(`
                        CREATE TABLE IF NOT EXISTS "${bindingTable}" (
                            ${idColumn},
                            ${createdAt},
                            ${updatedAt},
                            "templateId" integer NULL,
                            "bundleId" integer NULL,
                            "merchantId" integer NULL,
                            "storeId" integer NOT NULL,
                            "type" varchar(16) NOT NULL DEFAULT 'INCLUDE',
                            "priority" integer NOT NULL DEFAULT 0,
                            "isDefault" boolean NOT NULL DEFAULT ${boolDefault},
                            "channelId" integer NOT NULL
                        )`);
                }
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_template ON "${bindingTable}" ("templateId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_store ON "${bindingTable}" ("storeId")`,
                );
                // 组合索引（非唯一：templateId 可空，且同一模板同一门店允许 INCLUDE/EXCLUDE 语义演进）
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_template_store ON "${bindingTable}" ("templateId", "storeId")`,
                );

                // 2) 券核销流水
                const redemptionTable = 'coupon_redemption';
                if (!(await queryRunner.hasTable(redemptionTable))) {
                    await queryRunner.query(`
                        CREATE TABLE IF NOT EXISTS "${redemptionTable}" (
                            ${idColumn},
                            ${createdAt},
                            ${updatedAt},
                            "customerCouponId" integer NOT NULL,
                            "couponCode" varchar(255) NOT NULL,
                            "templateId" integer NOT NULL,
                            "saleOrderId" integer NULL,
                            "merchantId" integer NULL,
                            "storeId" integer NOT NULL,
                            "channelId" integer NOT NULL,
                            "redeemMode" varchar(16) NOT NULL DEFAULT 'QR',
                            "operatorId" integer NULL,
                            "operatorName" varchar(255) NULL,
                            "redeemedAt" ${dateType} NOT NULL,
                            "revokedAt" ${dateType} NULL,
                            "revokeReason" varchar(255) NULL,
                            "amount" integer NULL,
                            "storeSnapshot" text NULL,
                            "deviceInfo" varchar(255) NULL
                        )`);
                }
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON "${redemptionTable}" ("customerCouponId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_redemption_store ON "${redemptionTable}" ("storeId")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_redemption_template ON "${redemptionTable}" ("templateId")`,
                );

                // 3) 存量表补列（新库首次建表已含，此处幂等兜底）
                await this.ensureColumn(
                    queryRunner,
                    this.connection.getMetadata('CouponTemplate').tableName,
                    new TableColumn({
                        name: 'storeCoverage',
                        type: 'varchar',
                        isNullable: false,
                        default: "'ALL'",
                    }),
                );

                const saleOrderTable = this.connection.getMetadata('CouponSaleOrder').tableName;
                await this.ensureColumn(
                    queryRunner,
                    saleOrderTable,
                    new TableColumn({ name: 'storeId', type: 'integer', isNullable: true }),
                );
                await this.ensureColumn(
                    queryRunner,
                    saleOrderTable,
                    new TableColumn({ name: 'storeSnapshot', type: 'text', isNullable: true }),
                );

                await this.ensureColumn(
                    queryRunner,
                    this.connection.getMetadata('CustomerCoupon').tableName,
                    new TableColumn({ name: 'redeemedStoreId', type: 'integer', isNullable: true }),
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表/补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponStoreMigration] failed to ensure tables/columns:', e?.message);
        }
    }

    /** 列不存在才新增（幂等） */
    private async ensureColumn(queryRunner: QueryRunner, table: string, column: TableColumn): Promise<void> {
        if (!(await queryRunner.hasColumn(table, column.name))) {
            await queryRunner.addColumn(table, column);
        }
    }
}
