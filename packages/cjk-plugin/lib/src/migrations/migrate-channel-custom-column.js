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
exports.ChannelCustomColumnMigration = void 0;
// 确保 channel 表存在 shopName 自定义字段列（Vendure 命名规则：customFields + 首字母大写字段名）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列；
// 同时清理历史上误建的无前缀 shopname 列。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let ChannelCustomColumnMigration = class ChannelCustomColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('Channel');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                // 目标列：Vendure 自定义字段列名 = customFields + 首字母大写字段名，例如 shopName → customFieldsShopname
                const COL = 'customFieldsShopname';
                const cleanup = 'shopname';
                if (await queryRunner.hasColumn(tableName, cleanup)) {
                    await queryRunner.dropColumn(tableName, cleanup);
                    // eslint-disable-next-line no-console
                    console.log('[ChannelCustomColumnMigration] dropped stray column', cleanup);
                }
                if (!(await queryRunner.hasColumn(tableName, COL))) {
                    await queryRunner.addColumn(tableName, new typeorm_2.TableColumn({
                        name: COL,
                        type: 'varchar(255)',
                        isNullable: true,
                    }));
                }
                // domain 默认外网访问域名（同上，含首字母大写转换）
                const DOMAIN_COL = 'customFieldsDomain';
                if (!(await queryRunner.hasColumn(tableName, DOMAIN_COL))) {
                    await queryRunner.addColumn(tableName, new typeorm_2.TableColumn({
                        name: DOMAIN_COL,
                        type: 'varchar(255)',
                        isNullable: true,
                    }));
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[ChannelCustomColumnMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.ChannelCustomColumnMigration = ChannelCustomColumnMigration;
exports.ChannelCustomColumnMigration = ChannelCustomColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], ChannelCustomColumnMigration);
//# sourceMappingURL=migrate-channel-custom-column.js.map