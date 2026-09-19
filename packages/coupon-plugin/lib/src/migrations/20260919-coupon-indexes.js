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
exports.AddCouponIndexes20260919 = void 0;
// 为 3 处高频查询补索引（全部幂等 CREATE INDEX IF NOT EXISTS，兼容生产 PostgreSQL
// 与本地开发 SQLite，出错只打日志不抛错，不阻塞启动，等待下次启动重试）。
//  - product_coupon_binding("couponTemplateId")   -> 结算 listByTemplate 用
//  - coupon_template("claimCode")                 -> 普通索引（非唯一），claimCode 同租户内唯一由 service 层保证
//  - customer_coupon("customerId", "templateId")  -> countHeld 用
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddCouponIndexes20260919 = class AddCouponIndexes20260919 {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('ProductCouponBinding');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const indexes = [
                    // 结算按券模板查询绑定关系
                    `CREATE INDEX IF NOT EXISTS idx_binding_template ON "${tableName}" ("couponTemplateId")`,
                ];
                for (const sql of indexes) {
                    await queryRunner.query(sql);
                }
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coupon_template_claim_code ON coupon_template ("claimCode")`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_customer_coupon_customer_template ON customer_coupon ("customerId", "templateId")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补索引失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponIndexes20260919] failed to ensure indexes:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddCouponIndexes20260919 = AddCouponIndexes20260919;
exports.AddCouponIndexes20260919 = AddCouponIndexes20260919 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddCouponIndexes20260919);
//# sourceMappingURL=20260919-coupon-indexes.js.map