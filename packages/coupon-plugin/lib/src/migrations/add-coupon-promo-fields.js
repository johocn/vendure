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
// 券店营销扩展（首购立减 + 学生价 + 倒计时活动）幂等迁移：
// - coupon_template.studentPrice（学生价，分）
// - coupon_sale_order.discountType / discountAmount（让利记录）
// - channel.customFieldsFirstbuydiscount（首购立减，分，customFields 嵌入列）
// - channel.customFieldsCouponcampaign（倒计时活动配置 JSON，varchar(4096)，customFields 嵌入列）
// - customer.customFieldsStudentstatus / customFieldsStudentinfo / customFieldsStudentreviewedat（学生认证 customFields 嵌入列）
//
// 命名关键：Vendure customFields 注册为实体 embedded 列，TypeORM 生成的 DB 列名带
// `customFields` 前缀（如 customFieldsFirstbuydiscount），与 metadata 一致；
// 历史版本曾误建裸名列（firstBuyDiscount 等），metadata 不识别 → 生产 synchronize
// 每次启动都会 DROP。此处建正确列名后，把裸列历史数据搬过去并删除裸列。
// 每列逐个 hasColumn 判断后执行；失败只打日志不抛错，不阻塞启动，等待下次启动重试。
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
                    { table: tpl, name: 'studentPrice', type: 'integer' },
                    { table: sale, name: 'discountType', type: 'varchar' },
                    { table: sale, name: 'discountAmount', type: 'integer' },
                    // customFields 嵌入列（列名须与 TypeORM metadata 一致）
                    { table: channel, name: 'customFieldsFirstbuydiscount', type: 'integer', orphan: 'firstBuyDiscount' },
                    // 活动 JSON 较长：须与 customFields 定义（string length 4096）一致；已建列宽度不足时补 ALTER
                    { table: channel, name: 'customFieldsCouponcampaign', type: 'varchar', length: 4096 },
                    // 买单券监管参数组（T4）：全部可空 = 宽松默认，配置后才启用校验
                    { table: channel, name: 'customFieldsBillpaymaxsaleprice', type: 'integer' },
                    { table: channel, name: 'customFieldsBillpaymaxfacevalue', type: 'integer' },
                    { table: channel, name: 'customFieldsBillpaymaxbundletotal', type: 'integer' },
                    { table: channel, name: 'customFieldsBillpayminvaliddays', type: 'integer' },
                    { table: channel, name: 'customFieldsBillpayexpirerefundpolicy', type: 'varchar' },
                    { table: customer, name: 'customFieldsStudentstatus', type: 'varchar', orphan: 'studentStatus' },
                    { table: customer, name: 'customFieldsStudentinfo', type: 'varchar', orphan: 'studentInfo' },
                    { table: customer, name: 'customFieldsStudentreviewedat', type: 'timestamp', orphan: 'studentReviewedAt' },
                ];
                for (const { table, name, type, length, orphan } of plan) {
                    if (!table)
                        continue;
                    if (!(await queryRunner.hasColumn(table, name))) {
                        await queryRunner.addColumn(table, new typeorm_2.TableColumn({ name, type, length: length ? String(length) : undefined, isNullable: true }));
                    }
                    else if (length) {
                        // 已建列宽度可能小于当前定义（如先按默认 varchar(255) 落库）：幂等放宽
                        const col = () => new typeorm_2.TableColumn({ name, type, length: String(length), isNullable: true });
                        await queryRunner.changeColumn(table, col(), col());
                    }
                    // 历史裸名列：搬数据后删除（避免 synchronize 每次启动 DROP/重建）
                    if (orphan && (await queryRunner.hasColumn(table, orphan))) {
                        await queryRunner.query(`UPDATE "${table}" SET "${name}" = "${orphan}" WHERE "${orphan}" IS NOT NULL`);
                        await queryRunner.dropColumn(table, orphan);
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