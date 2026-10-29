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
exports.AddBillPayCouponBearerSnapshotMigration = void 0;
// 确保 bill_pay_order 表存在券成本承担口径快照列 couponBearer / couponCostRate。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-coupon-columns.ts 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddBillPayCouponBearerSnapshotMigration = class AddBillPayCouponBearerSnapshotMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('BillPayOrder');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(tableName))) {
                    return;
                }
                const columns = [
                    // 券成本承担方快照：PLATFORM | MERCHANT | SPLIT
                    new typeorm_2.TableColumn({ name: 'couponBearer', type: 'varchar(16)', isNullable: true }),
                    // 券成本分摊比例快照（0-100）
                    new typeorm_2.TableColumn({ name: 'couponCostRate', type: 'int', isNullable: true }),
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
            console.error('[AddBillPayCouponBearerSnapshotMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddBillPayCouponBearerSnapshotMigration = AddBillPayCouponBearerSnapshotMigration;
exports.AddBillPayCouponBearerSnapshotMigration = AddBillPayCouponBearerSnapshotMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddBillPayCouponBearerSnapshotMigration);
//# sourceMappingURL=add-bill-pay-coupon-bearer-snapshot.js.map