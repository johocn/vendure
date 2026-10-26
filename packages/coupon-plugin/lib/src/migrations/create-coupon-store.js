"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCouponStoreMigration = void 0;
// 券 ↔ 门店打通：幂等建 coupon_store_binding / coupon_redemption 两表，
// 并补 coupon_template.storeCoverage、coupon_sale_order.storeId/storeSnapshot、
// customer_coupon.redeemedStoreId 四类列（共 4 列）。
// 参照 create-coupon-sale.ts / create-coupon-settlement.ts 范式：生产 PostgreSQL 与本地 SQLite
// 都可能关闭 synchronize，故按 driver 分支建表、索引 IF NOT EXISTS、列 hasColumn 幂等判断；
// 失败只打日志不抛错，不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateCouponStoreMigration = class CreateCouponStoreMigration {
    constructor(connection) {
        this.connection = connection;
    }
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
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_template ON "${bindingTable}" ("templateId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_store ON "${bindingTable}" ("storeId")`);
                // 组合索引（非唯一：templateId 可空，且同一模板同一门店允许 INCLUDE/EXCLUDE 语义演进）
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_store_binding_template_store ON "${bindingTable}" ("templateId", "storeId")`);
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
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_redemption_coupon ON "${redemptionTable}" ("customerCouponId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_redemption_store ON "${redemptionTable}" ("storeId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_redemption_template ON "${redemptionTable}" ("templateId")`);
                // 3) 存量表补列（新库首次建表已含，此处幂等兜底）
                await this.ensureColumn(queryRunner, this.connection.getMetadata('CouponTemplate').tableName, new typeorm_2.TableColumn({
                    name: 'storeCoverage',
                    type: 'varchar',
                    isNullable: false,
                    default: "'ALL'",
                }));
                const saleOrderTable = this.connection.getMetadata('CouponSaleOrder').tableName;
                await this.ensureColumn(queryRunner, saleOrderTable, new typeorm_2.TableColumn({ name: 'storeId', type: 'integer', isNullable: true }));
                await this.ensureColumn(queryRunner, saleOrderTable, new typeorm_2.TableColumn({ name: 'storeSnapshot', type: 'text', isNullable: true }));
                await this.ensureColumn(queryRunner, this.connection.getMetadata('CustomerCoupon').tableName, new typeorm_2.TableColumn({ name: 'redeemedStoreId', type: 'integer', isNullable: true }));
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表/补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponStoreMigration] failed to ensure tables/columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
    /** 列不存在才新增（幂等） */
    async ensureColumn(queryRunner, table, column) {
        if (!(await queryRunner.hasColumn(table, column.name))) {
            await queryRunner.addColumn(table, column);
        }
    }
};
exports.CreateCouponStoreMigration = CreateCouponStoreMigration;
exports.CreateCouponStoreMigration = CreateCouponStoreMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponStoreMigration);
//# sourceMappingURL=create-coupon-store.js.map