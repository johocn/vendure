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
exports.CreateProductCouponBindingMigration = void 0;
// 确保 product_coupon_binding 表存在（生产 PostgreSQL 与本地开发 SQLite 都可能关闭
// synchronize，故此 migration 幂等地建表；表/索引均 IF NOT EXISTS，出错只打日志不抛错，
// 不阻塞启动，等待下次启动重试）。列类型对齐实体：variantIds 用 text 存 JSON 序列化，
// channelId 为 bigint，时间列 timestamptz，createdAt/updatedAt 默认 now()。
// id 自增写法 SQLite 与 PostgreSQL 不同（AUTOINCREMENT / SERIAL），按 driver 分支生成。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateProductCouponBindingMigration = class CreateProductCouponBindingMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('ProductCouponBinding');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const type = this.connection.driver.options.type;
                // sqlite 家族：sqljs（e2e 测试）/ better-sqlite3（本地 dev）/ sqlite，统一走 SQLite 分支
                const isSqlite = type === 'sqljs' || type === 'better-sqlite3' || type === 'sqlite';
                const createTableSql = isSqlite
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
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_binding_product ON "${tableName}" ("productId", "channelId")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_binding_template ON "${tableName}" ("couponTemplateId")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateProductCouponBindingMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateProductCouponBindingMigration = CreateProductCouponBindingMigration;
exports.CreateProductCouponBindingMigration = CreateProductCouponBindingMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateProductCouponBindingMigration);
//# sourceMappingURL=create-product-coupon-binding.js.map