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
exports.CreateCouponReconcileMigration = void 0;
// 确保 coupon_settlement_reconcile_diff 表存在（T5 对账差异表，对标 create-coupon-settlement 迁移模式）：
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，幂等建表 + 幂等索引。
// 出错只打日志不抛错，不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateCouponReconcileMigration = class CreateCouponReconcileMigration {
    constructor(connection) {
        this.connection = connection;
    }
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
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_reconcile_channel_run ON "${tableName}" ("channelId", "runId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_reconcile_channel_severity ON "${tableName}" ("channelId", "severity")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponReconcileMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCouponReconcileMigration = CreateCouponReconcileMigration;
exports.CreateCouponReconcileMigration = CreateCouponReconcileMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponReconcileMigration);
//# sourceMappingURL=create-coupon-settlement-reconcile.js.map