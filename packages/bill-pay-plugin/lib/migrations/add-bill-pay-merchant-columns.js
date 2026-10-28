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
exports.AddBillPayMerchantColumnsMigration = void 0;
// 确保 bill_pay_order / merchant_agreement / bill_pay_settlement 存在 merchantId 关联列。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-coupon-columns.ts 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const TARGETS = [
    { entity: 'BillPayOrder', table: 'bill_pay_order' },
    { entity: 'MerchantAgreement', table: 'merchant_agreement' },
    { entity: 'BillPaySettlement', table: 'bill_pay_settlement' },
];
let AddBillPayMerchantColumnsMigration = class AddBillPayMerchantColumnsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a, _b;
        for (const target of TARGETS) {
            try {
                const queryRunner = this.connection.createQueryRunner();
                try {
                    const tableName = (_b = (_a = this.connection.getMetadata(target.entity)) === null || _a === void 0 ? void 0 : _a.tableName) !== null && _b !== void 0 ? _b : target.table;
                    if (!(await queryRunner.hasTable(tableName))) {
                        continue;
                    }
                    if (!(await queryRunner.hasColumn(tableName, 'merchantId'))) {
                        await queryRunner.addColumn(tableName, new typeorm_2.TableColumn({ name: 'merchantId', type: 'int', isNullable: true }));
                    }
                }
                finally {
                    await queryRunner.release();
                }
            }
            catch (e) {
                // 补列失败不阻塞启动，等待下次启动重试
                // eslint-disable-next-line no-console
                console.error(`[AddBillPayMerchantColumnsMigration] failed to ensure ${target.table}.merchantId:`, e === null || e === void 0 ? void 0 : e.message);
            }
        }
    }
};
exports.AddBillPayMerchantColumnsMigration = AddBillPayMerchantColumnsMigration;
exports.AddBillPayMerchantColumnsMigration = AddBillPayMerchantColumnsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddBillPayMerchantColumnsMigration);
//# sourceMappingURL=add-bill-pay-merchant-columns.js.map