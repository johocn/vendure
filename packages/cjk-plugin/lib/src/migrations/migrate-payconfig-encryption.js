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
exports.PayConfigEncryptionMigration = exports.PAY_CONFIG_MIGRATION_DONE = void 0;
// packages/cjk-plugin/src/migrations/migrate-payconfig-encryption.ts
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pay_config_crypto_1 = require("../payment/pay-config-crypto");
const crypto_1 = require("../auth/crypto");
exports.PAY_CONFIG_MIGRATION_DONE = 'PAY_CONFIG_MIGRATION_DONE';
const DISCRIMINATOR = 'tenant-config-migration';
let PayConfigEncryptionMigration = class PayConfigEncryptionMigration {
    constructor(connection, channelService) {
        this.connection = connection;
        this.channelService = channelService;
    }
    async onApplicationBootstrap() {
        var _a;
        const ctx = core_1.RequestContext.empty();
        const done = await this.connection
            .createQueryBuilder()
            .select('id')
            .from('history_entry', 'he')
            .where('he.type = :type', { type: exports.PAY_CONFIG_MIGRATION_DONE })
            .getRawOne();
        if (done)
            return;
        const channels = await this.channelService.findAll(ctx);
        let migrated = 0;
        for (const channel of channels.items) {
            const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.payConfig;
            if (!raw)
                continue;
            let changed = false;
            const newStruct = Object.assign({}, raw);
            for (const field of ['alipayJson', 'wechatpayJson', 'douyinpayJson']) {
                const json = raw[field];
                if (!json)
                    continue;
                try {
                    const parsed = JSON.parse(json);
                    // 简单检测:任一 secret 字段未加密则迁移
                    const needs = this.needsEncryption(parsed);
                    if (!needs)
                        continue;
                    const encrypted = (0, pay_config_crypto_1.encryptPayConfig)(parsed);
                    newStruct[field] = JSON.stringify(encrypted);
                    changed = true;
                }
                catch (_b) { }
            }
            if (changed) {
                await this.channelService.update(ctx, { id: channel.id, customFields: { payConfig: newStruct } });
                migrated++;
            }
        }
        // 用 query builder 直接插入(因 HistoryEntry 是 abstract 单表继承,不能 save 对象字面量)
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            type: exports.PAY_CONFIG_MIGRATION_DONE,
            isPublic: false,
            data: JSON.stringify({ migrated }),
            discriminator: DISCRIMINATOR,
        })
            .execute();
    }
    needsEncryption(config) {
        var _a, _b, _c, _d, _e;
        if (((_a = config.alipay) === null || _a === void 0 ? void 0 : _a.privateKey) && !(0, crypto_1.isEncrypted)(config.alipay.privateKey))
            return true;
        if (((_b = config.wechatpay) === null || _b === void 0 ? void 0 : _b.privateKey) && !(0, crypto_1.isEncrypted)(config.wechatpay.privateKey))
            return true;
        if (((_c = config.wechatpay) === null || _c === void 0 ? void 0 : _c.apiKey) && !(0, crypto_1.isEncrypted)(config.wechatpay.apiKey))
            return true;
        if (((_d = config.douyinpay) === null || _d === void 0 ? void 0 : _d.appSecret) && !(0, crypto_1.isEncrypted)(config.douyinpay.appSecret))
            return true;
        if (((_e = config.douyinpay) === null || _e === void 0 ? void 0 : _e.privateKey) && !(0, crypto_1.isEncrypted)(config.douyinpay.privateKey))
            return true;
        return false;
    }
};
exports.PayConfigEncryptionMigration = PayConfigEncryptionMigration;
exports.PayConfigEncryptionMigration = PayConfigEncryptionMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        core_1.ChannelService])
], PayConfigEncryptionMigration);
//# sourceMappingURL=migrate-payconfig-encryption.js.map