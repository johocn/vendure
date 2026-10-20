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
exports.CreateCouponFrFMigration = void 0;
// 幂等建 FR-F1 每日领券留痕表：coupon_daily_claim_record（同渠道同人同券同业务日唯一索引）。
// 生产 PostgreSQL 与本地 SQLite 都可能关闭 synchronize，参照 CreateCouponFissionMigration 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const TABLE = 'coupon_daily_claim_record';
const INDEX = 'IDX_coupon_daily_claim_channel_customer_template_date';
let CreateCouponFrFMigration = class CreateCouponFrFMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a, _b;
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(TABLE))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: TABLE,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'channelId', type: 'int', isNullable: false },
                            { name: 'customerId', type: 'int', isNullable: false },
                            { name: 'templateId', type: 'int', isNullable: false },
                            { name: 'claimDate', type: 'varchar', isNullable: false, length: '10' },
                            { name: 'couponId', type: 'int', isNullable: true },
                        ],
                        indices: [
                            new typeorm_2.TableIndex({
                                name: INDEX,
                                columnNames: ['channelId', 'customerId', 'templateId', 'claimDate'],
                                isUnique: true,
                            }),
                        ],
                    }));
                }
                else {
                    // 表已存在但唯一索引可能缺失（历史环境），幂等补建
                    const tableMeta = await queryRunner.getTable(TABLE);
                    const hasIndex = (_b = (_a = tableMeta === null || tableMeta === void 0 ? void 0 : tableMeta.indices) === null || _a === void 0 ? void 0 : _a.some(i => i.name === INDEX)) !== null && _b !== void 0 ? _b : false;
                    if (!hasIndex) {
                        await queryRunner.createIndex(TABLE, new typeorm_2.TableIndex({
                            name: INDEX,
                            columnNames: ['channelId', 'customerId', 'templateId', 'claimDate'],
                            isUnique: true,
                        }));
                    }
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponFrFMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCouponFrFMigration = CreateCouponFrFMigration;
exports.CreateCouponFrFMigration = CreateCouponFrFMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponFrFMigration);
//# sourceMappingURL=create-coupon-frf.js.map