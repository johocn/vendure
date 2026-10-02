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
exports.CreateCouponSaleMigration = void 0;
// 幂等建出售相关表：coupon_sale_order / coupon_bundle / coupon_bundle_item，
// 并补 customer_coupon.saleOrderId 列。生产 PG 与本地 SQLite 都可能关闭 synchronize。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateCouponSaleMigration = class CreateCouponSaleMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const saleTable = 'coupon_sale_order';
                if (!(await queryRunner.hasTable(saleTable))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: saleTable,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'customerId', type: 'int', isNullable: false },
                            { name: 'payMode', type: 'varchar', isNullable: false },
                            { name: 'templateId', type: 'int', isNullable: true },
                            { name: 'bundleId', type: 'int', isNullable: true },
                            { name: 'orderId', type: 'int', isNullable: true },
                            { name: 'surchargeId', type: 'int', isNullable: true },
                            { name: 'amount', type: 'int', isNullable: false },
                            { name: 'status', type: 'varchar', isNullable: false },
                            { name: 'paymentMethod', type: 'varchar', isNullable: true },
                            { name: 'externalRef', type: 'varchar', isNullable: true },
                            { name: 'paidAt', type: 'datetime', isNullable: true },
                            { name: 'refundedAt', type: 'datetime', isNullable: true },
                            { name: 'remark', type: 'text', isNullable: true },
                            { name: 'channelId', type: 'int', isNullable: false },
                        ],
                    }));
                }
                const bundleTable = 'coupon_bundle';
                if (!(await queryRunner.hasTable(bundleTable))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: bundleTable,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'name', type: 'text', isNullable: false },
                            { name: 'description', type: 'text', isNullable: true },
                            { name: 'salePrice', type: 'int', isNullable: false },
                            { name: 'enabled', type: 'boolean', isNullable: false, default: true },
                            { name: 'shopId', type: 'int', isNullable: true },
                            { name: 'channelId', type: 'int', isNullable: false },
                        ],
                    }));
                }
                const itemTable = 'coupon_bundle_item';
                if (!(await queryRunner.hasTable(itemTable))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: itemTable,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'bundleId', type: 'int', isNullable: false },
                            { name: 'templateId', type: 'int', isNullable: false },
                            { name: 'quantity', type: 'int', isNullable: false, default: 1 },
                        ],
                    }));
                }
                const ccMeta = this.connection.getMetadata('CustomerCoupon');
                const ccTable = ccMeta.tableName;
                const saleOrderId = new typeorm_2.TableColumn({ name: 'saleOrderId', type: 'int', isNullable: true });
                if (!(await queryRunner.hasColumn(ccTable, saleOrderId.name))) {
                    await queryRunner.addColumn(ccTable, saleOrderId);
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponSaleMigration] failed to ensure tables:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCouponSaleMigration = CreateCouponSaleMigration;
exports.CreateCouponSaleMigration = CreateCouponSaleMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponSaleMigration);
//# sourceMappingURL=create-coupon-sale.js.map