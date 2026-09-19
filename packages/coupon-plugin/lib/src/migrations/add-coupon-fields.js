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
exports.AddCouponFieldsMigration = void 0;
// 确保 coupon_template 表存在券领取/核销相关 5 列（生产 PostgreSQL 与本地开发 SQLite
// 都可能关闭 synchronize，故此 migration 幂等地补列；每列逐个 hasColumn 判断后 addColumn，
// 出错只打日志不抛错，不阻塞启动，等待下次启动重试）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddCouponFieldsMigration = class AddCouponFieldsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const columns = [
                    // 详情页领券入口开关（binding.enabled && claimable 才展示领券入口）
                    new typeorm_2.TableColumn({ name: 'claimable', type: 'boolean', isNullable: false, default: true }),
                    // 兑换码（非空=支持凭码兑换；同租户内唯一由 service 层保证）
                    new typeorm_2.TableColumn({ name: 'claimCode', type: 'varchar(255)', isNullable: true }),
                    // 领取后 N 天有效（空=走固定 startsAt/endsAt）
                    new typeorm_2.TableColumn({ name: 'validDays', type: 'integer', isNullable: true }),
                    // 仅限新客（本租户无历史有效订单）可领可用
                    new typeorm_2.TableColumn({ name: 'newCustomerOnly', type: 'boolean', isNullable: false, default: false }),
                    // 会员等级限定（预留，本期只建字段不开发逻辑）
                    new typeorm_2.TableColumn({ name: 'memberLevel', type: 'varchar(255)', isNullable: true }),
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
            console.error('[AddCouponFieldsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddCouponFieldsMigration = AddCouponFieldsMigration;
exports.AddCouponFieldsMigration = AddCouponFieldsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddCouponFieldsMigration);
//# sourceMappingURL=add-coupon-fields.js.map