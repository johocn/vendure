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
exports.CreateCouponSettlementMigration = void 0;
// 确保 coupon_settlement_order 表存在（T1 结算单，对标 create-in-store-bill 迁移模式）：
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，幂等建表 + 幂等索引；
// customerCouponId / settlementNo 唯一索引 = 防重复出单（风险铁律④）。
// 出错只打日志不抛错，不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateCouponSettlementMigration = class CreateCouponSettlementMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponSettlementOrder');
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
                        "saleOrderId" integer NULL,
                        "customerCouponId" integer NOT NULL,
                        "templateId" integer NULL,
                        "redeemRef" varchar(255) NOT NULL,
                        "inStoreBillId" integer NULL,
                        "faceAmount" integer NOT NULL,
                        "commissionRateBp" integer NOT NULL DEFAULT 0,
                        "commissionAmount" integer NOT NULL DEFAULT 0,
                        "netAmount" integer NOT NULL DEFAULT 0,
                        "status" varchar(255) NOT NULL,
                        "settlementNo" varchar(255) NOT NULL,
                        "splitMode" varchar(255) NULL,
                        "splitReceiptNo" varchar(255) NULL,
                        "attempts" integer NOT NULL DEFAULT 0,
                        "lastError" text NULL,
                        "settledAt" datetime NULL,
                        "paidOutAt" datetime NULL,
                        "reversedAt" datetime NULL,
                        "remark" varchar(255) NULL
                    )`
                    : `
                    CREATE TABLE IF NOT EXISTS "${tableName}" (
                        "id" SERIAL PRIMARY KEY,
                        "createdAt" timestamptz NOT NULL DEFAULT now(),
                        "updatedAt" timestamptz NOT NULL DEFAULT now(),
                        "channelId" bigint NOT NULL,
                        "saleOrderId" integer NULL,
                        "customerCouponId" integer NOT NULL,
                        "templateId" integer NULL,
                        "redeemRef" varchar(255) NOT NULL,
                        "inStoreBillId" integer NULL,
                        "faceAmount" integer NOT NULL,
                        "commissionRateBp" integer NOT NULL DEFAULT 0,
                        "commissionAmount" integer NOT NULL DEFAULT 0,
                        "netAmount" integer NOT NULL DEFAULT 0,
                        "status" varchar(255) NOT NULL,
                        "settlementNo" varchar(255) NOT NULL,
                        "splitMode" varchar(255) NULL,
                        "splitReceiptNo" varchar(255) NULL,
                        "attempts" integer NOT NULL DEFAULT 0,
                        "lastError" text NULL,
                        "settledAt" timestamptz NULL,
                        "paidOutAt" timestamptz NULL,
                        "reversedAt" timestamptz NULL,
                        "remark" varchar(255) NULL
                    )`;
                await queryRunner.query(createTableSql);
                // 防重复出单双保险：券实例唯一 + 结算单号唯一（幂等键）
                await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_coupon_settlement_coupon ON "${tableName}" ("customerCouponId")`);
                await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_coupon_settlement_no ON "${tableName}" ("settlementNo")`);
                // 状态扫描（job 下推查询）与渠道维度索引（幂等）
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_settlement_channel_status ON "${tableName}" ("channelId", "status")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_settlement_sale_order ON "${tableName}" ("saleOrderId")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponSettlementMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCouponSettlementMigration = CreateCouponSettlementMigration;
exports.CreateCouponSettlementMigration = CreateCouponSettlementMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponSettlementMigration);
//# sourceMappingURL=create-coupon-settlement.js.map