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
exports.PickupStoreLinkSoftDeleteMigration = void 0;
// 幂等补充 pickup_location 的门店关联与软删列：
// - merchantStoreId：关联 merchant-plugin 的 merchant_store（历史数据由 create-merchant-tables 按 type=store 回填）
// - deletedAt：软删时间，删除仅置该字段，避免历史订单/配送档案引用失效
// 生产库 DB_SYNC=0，因此列必须由本迁移补齐；失败不阻塞启动，下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let PickupStoreLinkSoftDeleteMigration = class PickupStoreLinkSoftDeleteMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('pickup_location'))) {
                return;
            }
            const Q = (name) => this.connection.driver.escape(name);
            const driver = this.connection.options.type;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const timestamp = isPostgres ? 'timestamptz' : 'datetime';
            if (!(await queryRunner.hasColumn('pickup_location', 'merchantStoreId'))) {
                await queryRunner.query(`ALTER TABLE ${Q('pickup_location')} ADD COLUMN ${Q('merchantStoreId')} integer NULL`);
                // eslint-disable-next-line no-console
                console.log('[PickupStoreLinkSoftDeleteMigration] added pickup_location.merchantStoreId');
            }
            if (!(await queryRunner.hasColumn('pickup_location', 'deletedAt'))) {
                await queryRunner.query(`ALTER TABLE ${Q('pickup_location')} ADD COLUMN ${Q('deletedAt')} ${timestamp} NULL`);
                // eslint-disable-next-line no-console
                console.log('[PickupStoreLinkSoftDeleteMigration] added pickup_location.deletedAt');
            }
            // SQLite/Postgres 支持 IF NOT EXISTS；MySQL/MariaDB 不支持，重复创建交由异常吞掉
            const ifNotExists = isPostgres || driver === 'sqlite' || driver === 'better-sqlite3' || driver === 'sqljs';
            try {
                await queryRunner.query(`CREATE INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${Q('idx_pickup_location_merchantStoreId')} ` +
                    `ON ${Q('pickup_location')} (${Q('merchantStoreId')})`);
            }
            catch (_a) {
                // 索引已存在时忽略
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[PickupStoreLinkSoftDeleteMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.PickupStoreLinkSoftDeleteMigration = PickupStoreLinkSoftDeleteMigration;
exports.PickupStoreLinkSoftDeleteMigration = PickupStoreLinkSoftDeleteMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], PickupStoreLinkSoftDeleteMigration);
//# sourceMappingURL=migrate-pickup-store-link-soft-delete.js.map