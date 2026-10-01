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
exports.CreateInStoreBillMigration = void 0;
// 确保 in_store_bill 表存在（生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，
// 故此 migration 幂等建表；表/索引均 IF NOT EXISTS，出错只打日志不抛错，不阻塞启动，
// 等待下次启动重试）。列类型对齐实体：channelId 为 bigint，时间列 timestamptz，
// 金额列 integer（分），createdAt/updatedAt 默认 now()。
// id 自增写法 SQLite 与 PostgreSQL 不同（AUTOINCREMENT / SERIAL），按 driver 分支生成。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateInStoreBillMigration = class CreateInStoreBillMigration {
    constructor(connection) {
        this.connection = connection;
    }
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
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_in_store_bill_code ON "${tableName}" ("couponCode")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_in_store_bill_customer ON "${tableName}" ("customerId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_in_store_bill_channel_time ON "${tableName}" ("channelId", "billedAt")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateInStoreBillMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateInStoreBillMigration = CreateInStoreBillMigration;
exports.CreateInStoreBillMigration = CreateInStoreBillMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateInStoreBillMigration);
//# sourceMappingURL=create-in-store-bill.js.map