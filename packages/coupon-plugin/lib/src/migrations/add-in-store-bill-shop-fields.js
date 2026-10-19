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
exports.AddInStoreBillShopFieldsMigration = void 0;
// 到店买单流水补门店字段（T2）：shopId（门店归属，结算分账的商户定位）+ shopName（快照）。
// 幂等逐列 hasColumn 判断后执行；失败只打日志不抛错，不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddInStoreBillShopFieldsMigration = class AddInStoreBillShopFieldsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('InStoreBill').tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const plan = [
                    new typeorm_2.TableColumn({ name: 'shopId', type: 'integer', isNullable: true }),
                    new typeorm_2.TableColumn({ name: 'shopName', type: 'varchar', isNullable: true }),
                ];
                for (const col of plan) {
                    if (!(await queryRunner.hasColumn(tableName, col.name))) {
                        await queryRunner.addColumn(tableName, col);
                    }
                }
                // 门店维度汇总查询（分账对账）索引（幂等）
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_in_store_bill_shop ON "${tableName}" ("shopId")`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddInStoreBillShopFieldsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddInStoreBillShopFieldsMigration = AddInStoreBillShopFieldsMigration;
exports.AddInStoreBillShopFieldsMigration = AddInStoreBillShopFieldsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddInStoreBillShopFieldsMigration);
//# sourceMappingURL=add-in-store-bill-shop-fields.js.map