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
exports.MapConfigEncryptionMigration = exports.MAP_CONFIG_MIGRATION_DONE = void 0;
// packages/cjk-plugin/src/migrations/migrate-mapconfig-encryption.ts
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const map_crypto_1 = require("../map/map-crypto");
const crypto_1 = require("../auth/crypto");
exports.MAP_CONFIG_MIGRATION_DONE = 'MAP_CONFIG_MIGRATION_DONE';
const DISCRIMINATOR = 'tenant-config-migration';
let MapConfigEncryptionMigration = class MapConfigEncryptionMigration {
    constructor(connection, channelService) {
        this.connection = connection;
        this.channelService = channelService;
    }
    async onApplicationBootstrap() {
        var _a;
        const ctx = core_1.RequestContext.empty();
        // 幂等检查:若已迁移过则跳过
        const done = await this.connection
            .createQueryBuilder()
            .select('id')
            .from('history_entry', 'he')
            .where('he.type = :type', { type: exports.MAP_CONFIG_MIGRATION_DONE })
            .getRawOne();
        if (done)
            return;
        const channels = await this.channelService.findAll(ctx);
        let migrated = 0;
        for (const channel of channels.items) {
            const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.mapConfig;
            if (!raw)
                continue;
            const needsMigration = (raw.apiKey && !(0, crypto_1.isEncrypted)(raw.apiKey)) ||
                (raw.securityJsCode && !(0, crypto_1.isEncrypted)(raw.securityJsCode));
            if (!needsMigration)
                continue;
            const encrypted = (0, map_crypto_1.encryptMapConfig)(raw);
            await this.channelService.update(ctx, {
                id: channel.id,
                customFields: { mapConfig: encrypted },
            });
            migrated++;
        }
        // 用 query builder 直接插入(因 HistoryEntry 是 abstract 单表继承,不能 save 对象字面量)
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
            createdAt: () => 'NOW()',
            updatedAt: () => 'NOW()',
            type: exports.MAP_CONFIG_MIGRATION_DONE,
            isPublic: false,
            data: JSON.stringify({ migrated }),
            discriminator: DISCRIMINATOR,
        })
            .execute();
    }
};
exports.MapConfigEncryptionMigration = MapConfigEncryptionMigration;
exports.MapConfigEncryptionMigration = MapConfigEncryptionMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        core_1.ChannelService])
], MapConfigEncryptionMigration);
//# sourceMappingURL=migrate-mapconfig-encryption.js.map