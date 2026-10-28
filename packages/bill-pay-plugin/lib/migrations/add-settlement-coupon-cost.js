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
exports.AddSettlementCouponCostMigration = void 0;
// 确保 bill_pay_settlement 表存在券成本承担相关 5 列。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// 每列逐个 hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-merchant-columns.ts 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddSettlementCouponCostMigration = class AddSettlementCouponCostMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a, _b;
        try {
            const tableName = (_b = (_a = this.connection.getMetadata('BillPaySettlement')) === null || _a === void 0 ? void 0 : _a.tableName) !== null && _b !== void 0 ? _b : 'bill_pay_settlement';
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(tableName))) {
                    return;
                }
                const columns = [
                    // 本单实际券抵扣额（分）
                    new typeorm_2.TableColumn({ name: 'couponAmount', type: 'integer', default: 0 }),
                    // 券成本承担方快照：PLATFORM | MERCHANT | SPLIT
                    new typeorm_2.TableColumn({ name: 'couponBearer', type: 'varchar(16)', default: "'PLATFORM'" }),
                    // 券成本分摊比例快照（0-100）
                    new typeorm_2.TableColumn({ name: 'couponCostRate', type: 'integer', default: 0 }),
                    // 商户承担的券成本（从应付商户款扣减）
                    new typeorm_2.TableColumn({ name: 'merchantCouponCost', type: 'integer', default: 0 }),
                    // 平台承担的券成本
                    new typeorm_2.TableColumn({ name: 'platformCouponCost', type: 'integer', default: 0 }),
                ];
                for (const column of columns) {
                    if (!(await queryRunner.hasColumn(tableName, column.name))) {
                        await queryRunner.addColumn(tableName, column);
                    }
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddSettlementCouponCostMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddSettlementCouponCostMigration = AddSettlementCouponCostMigration;
exports.AddSettlementCouponCostMigration = AddSettlementCouponCostMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddSettlementCouponCostMigration);
//# sourceMappingURL=add-settlement-coupon-cost.js.map