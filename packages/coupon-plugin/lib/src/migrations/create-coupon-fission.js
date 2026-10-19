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
exports.CreateCouponFissionMigration = void 0;
// 幂等建 FR-C/FR-E1 留痕表：coupon_fission_record（同人同活动唯一索引）/ coupon_grant_batch。
// 生产 PostgreSQL 与本地 SQLite 都可能关闭 synchronize，参照 CreateCouponSaleMigration 范式。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let CreateCouponFissionMigration = class CreateCouponFissionMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a, _b;
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const fissionTable = 'coupon_fission_record';
                if (!(await queryRunner.hasTable(fissionTable))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: fissionTable,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'channelId', type: 'int', isNullable: false },
                            { name: 'inviterCustomerId', type: 'int', isNullable: false },
                            { name: 'inviteeCustomerId', type: 'int', isNullable: false },
                            { name: 'inviteeCouponId', type: 'int', isNullable: true },
                            { name: 'inviterCouponId', type: 'int', isNullable: true },
                            { name: 'status', type: 'varchar', isNullable: false, default: "'OK'" },
                            { name: 'sharedAt', type: 'datetime', isNullable: true },
                        ],
                        indices: [
                            new typeorm_2.TableIndex({
                                name: 'IDX_coupon_fission_record_channel_invitee',
                                columnNames: ['channelId', 'inviteeCustomerId'],
                                isUnique: true,
                            }),
                        ],
                    }));
                }
                else {
                    // 表已存在但唯一索引可能缺失（历史环境），幂等补建
                    const tableMeta = await queryRunner.getTable(fissionTable);
                    const hasIndex = (_b = (_a = tableMeta === null || tableMeta === void 0 ? void 0 : tableMeta.indices) === null || _a === void 0 ? void 0 : _a.some(i => i.name === 'IDX_coupon_fission_record_channel_invitee')) !== null && _b !== void 0 ? _b : false;
                    if (!hasIndex) {
                        await queryRunner.createIndex(fissionTable, new typeorm_2.TableIndex({
                            name: 'IDX_coupon_fission_record_channel_invitee',
                            columnNames: ['channelId', 'inviteeCustomerId'],
                            isUnique: true,
                        }));
                    }
                }
                const batchTable = 'coupon_grant_batch';
                if (!(await queryRunner.hasTable(batchTable))) {
                    await queryRunner.createTable(new typeorm_2.Table({
                        name: batchTable,
                        columns: [
                            { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                            { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                            { name: 'channelId', type: 'int', isNullable: false },
                            { name: 'templateId', type: 'int', isNullable: false },
                            { name: 'days', type: 'int', isNullable: false, default: 90 },
                            { name: 'totalSelected', type: 'int', isNullable: false, default: 0 },
                            { name: 'issuedCount', type: 'int', isNullable: false, default: 0 },
                            { name: 'skippedCount', type: 'int', isNullable: false, default: 0 },
                            { name: 'resultsJson', type: 'text', isNullable: true },
                            { name: 'operator', type: 'varchar', isNullable: true },
                            { name: 'notified', type: 'boolean', isNullable: false, default: false },
                        ],
                    }));
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponFissionMigration] failed to ensure tables:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCouponFissionMigration = CreateCouponFissionMigration;
exports.CreateCouponFissionMigration = CreateCouponFissionMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCouponFissionMigration);
//# sourceMappingURL=create-coupon-fission.js.map