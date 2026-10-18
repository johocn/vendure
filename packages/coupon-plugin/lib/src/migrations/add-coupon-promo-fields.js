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
exports.AddCouponPromoFieldsMigration = void 0;
// 券店营销扩展（首购立减 + 学生价）幂等迁移：
// - coupon_template.studentPrice（学生价，分）
// - coupon_sale_order.discountType / discountAmount（让利记录）
// - channel.firstBuyDiscount（首购立减，分，customFields）
// - customer.studentStatus / studentInfo / studentReviewedAt（学生认证 customFields）
// 每列逐个 hasColumn 判断后 addColumn；失败只打日志不抛错，不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddCouponPromoFieldsMigration = class AddCouponPromoFieldsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            // 通过实体元数据解析真实表名（兼容表前缀），缺实体则整体跳过
            const tableName = (entityName) => {
                try {
                    return this.connection.getMetadata(entityName).tableName;
                }
                catch (_a) {
                    return null;
                }
            };
            const tpl = tableName('CouponTemplate');
            const sale = tableName('CouponSaleOrder');
            const channel = tableName('Channel');
            const customer = tableName('Customer');
            const queryRunner = this.connection.createQueryRunner();
            try {
                const plan = [
                    [tpl, new typeorm_2.TableColumn({ name: 'studentPrice', type: 'integer', isNullable: true })],
                    [sale, new typeorm_2.TableColumn({ name: 'discountType', type: 'varchar', isNullable: true })],
                    [sale, new typeorm_2.TableColumn({ name: 'discountAmount', type: 'integer', isNullable: true })],
                    [channel, new typeorm_2.TableColumn({ name: 'firstBuyDiscount', type: 'integer', isNullable: true })],
                    [customer, new typeorm_2.TableColumn({ name: 'studentStatus', type: 'varchar', isNullable: true })],
                    [customer, new typeorm_2.TableColumn({ name: 'studentInfo', type: 'varchar', isNullable: true })],
                    [customer, new typeorm_2.TableColumn({ name: 'studentReviewedAt', type: 'timestamp', isNullable: true })],
                ];
                for (const [table, column] of plan) {
                    if (!table)
                        continue;
                    if (!(await queryRunner.hasColumn(table, column.name))) {
                        await queryRunner.addColumn(table, column);
                    }
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddCouponPromoFieldsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddCouponPromoFieldsMigration = AddCouponPromoFieldsMigration;
exports.AddCouponPromoFieldsMigration = AddCouponPromoFieldsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddCouponPromoFieldsMigration);
//# sourceMappingURL=add-coupon-promo-fields.js.map