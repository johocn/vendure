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
exports.AddCouponDistributionChannelsMigration = void 0;
// 确保 coupon_template 表存在 distributionChannels / salePrice 列（生产 PostgreSQL 与本地开发
// SQLite 都可能关闭 synchronize，故此 migration 幂等补列；出错只打日志不抛错，不阻塞启动）。
// distributionChannels 允许为 NULL（历史券走老字段推导）；salePrice 默认 0（不可售）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddCouponDistributionChannelsMigration = class AddCouponDistributionChannelsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const channels = new typeorm_2.TableColumn({
                    name: 'distributionChannels',
                    type: 'varchar(255)',
                    isNullable: true,
                });
                if (!(await queryRunner.hasColumn(tableName, channels.name))) {
                    await queryRunner.addColumn(tableName, channels);
                }
                const salePrice = new typeorm_2.TableColumn({
                    name: 'salePrice',
                    type: 'int',
                    isNullable: false,
                    default: '0',
                });
                if (!(await queryRunner.hasColumn(tableName, salePrice.name))) {
                    await queryRunner.addColumn(tableName, salePrice);
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponDistributionChannelsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddCouponDistributionChannelsMigration = AddCouponDistributionChannelsMigration;
exports.AddCouponDistributionChannelsMigration = AddCouponDistributionChannelsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddCouponDistributionChannelsMigration);
//# sourceMappingURL=add-coupon-distribution-channels.js.map