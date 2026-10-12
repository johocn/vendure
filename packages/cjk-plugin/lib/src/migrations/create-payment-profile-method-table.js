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
exports.PaymentProfileMethodTableMigration = void 0;
// 幂等补建 payment_profile_method 表（支付档案 × 支付方式的模式载荷表）。
// 背景：PaymentProfileMethod 实体此前未注册进 plugin entities，TypeORM 无 metadata，
// checkoutSplitted 对关联支付档案的商品下单时 attachMethodConfigs 报
// "No metadata for PaymentProfileMethod was found"（2026-10-12 线上）。
// 本 migration 与实体注册配合：注册提供 metadata，此处保证表真实存在。
// 列与 payment-profile-method.entity.ts 完全对齐；幂等由 IF NOT EXISTS 保证，失败不阻塞启动。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
function isPostgres(driver) {
    return driver === 'postgres' || driver === 'postgresql';
}
let PaymentProfileMethodTableMigration = class PaymentProfileMethodTableMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            const driver = this.connection.options.type;
            const pg = isPostgres(driver);
            const pk = pg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
            const datetime = pg ? 'timestamptz' : 'datetime';
            const Q = (s) => `"${s}"`;
            await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${Q('payment_profile_method')} (` +
                `${Q('id')} ${pk}, ` +
                `${Q('createdAt')} ${datetime} NOT NULL, ` +
                `${Q('updatedAt')} ${datetime} NOT NULL, ` +
                `${Q('profileId')} varchar(255) NOT NULL, ` +
                `${Q('paymentMethodId')} varchar(255) NOT NULL, ` +
                `${Q('mode')} varchar(255) NOT NULL DEFAULT 'installment', ` +
                `${Q('options')} text NULL)`);
            // 查询路径均以 profileId 为入口（findOne: profileId+paymentMethodId / attachMethodConfigs: profileId）
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${'idx_payment_profile_method_profileId'} ` +
                `ON ${Q('payment_profile_method')} (${Q('profileId')})`);
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[PaymentProfileMethodTableMigration] failed to ensure table:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.PaymentProfileMethodTableMigration = PaymentProfileMethodTableMigration;
exports.PaymentProfileMethodTableMigration = PaymentProfileMethodTableMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], PaymentProfileMethodTableMigration);
//# sourceMappingURL=create-payment-profile-method-table.js.map