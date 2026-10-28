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
exports.AddCouponCostBearerMigration = void 0;
// 确保 coupon_template 表存在券成本承担相关 2 列（costBearer 承担方 / merchantCostRate 商户承担比例）。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等地补列；
// 每列逐个 hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-coupon-marketing-fields.ts 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddCouponCostBearerMigration = class AddCouponCostBearerMigration {
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
                    // 成本承担方：PLATFORM（平台，默认）| MERCHANT（商户）| SPLIT（按比例分摊）
                    new typeorm_2.TableColumn({ name: 'costBearer', type: 'varchar(16)', default: "'PLATFORM'" }),
                    // SPLIT 下商户承担比例（0-100）；PLATFORM/MERCHANT 由服务层规范化为 0/100
                    new typeorm_2.TableColumn({ name: 'merchantCostRate', type: 'integer', default: 0 }),
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
            console.error('[AddCouponCostBearerMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddCouponCostBearerMigration = AddCouponCostBearerMigration;
exports.AddCouponCostBearerMigration = AddCouponCostBearerMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddCouponCostBearerMigration);
//# sourceMappingURL=add-coupon-cost-bearer.js.map