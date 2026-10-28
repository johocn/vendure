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
exports.AddMerchantDeletedAtMigration = void 0;
// 幂等补充 merchant.deletedAt 软删列（与 merchant_store.deletedAt 语义一致）：
// 商户删除只置该字段，避免历史门店/认领/券等引用失效。
// 生产库 DB_SYNC=0，因此列必须由本迁移补齐；失败不阻塞启动，下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddMerchantDeletedAtMigration = class AddMerchantDeletedAtMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('merchant'))) {
                return;
            }
            if (await queryRunner.hasColumn('merchant', 'deletedAt')) {
                return;
            }
            const Q = (name) => this.connection.driver.escape(name);
            const driver = this.connection.options.type;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const timestamp = isPostgres ? 'timestamptz' : 'datetime';
            await queryRunner.query(`ALTER TABLE ${Q('merchant')} ADD COLUMN ${Q('deletedAt')} ${timestamp} NULL`);
            // eslint-disable-next-line no-console
            console.log('[AddMerchantDeletedAtMigration] added merchant.deletedAt');
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddMerchantDeletedAtMigration] failed to ensure column:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.AddMerchantDeletedAtMigration = AddMerchantDeletedAtMigration;
exports.AddMerchantDeletedAtMigration = AddMerchantDeletedAtMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddMerchantDeletedAtMigration);
//# sourceMappingURL=add-merchant-deleted-at.js.map