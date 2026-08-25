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
exports.MarketplaceCustomColumnMigration = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/**
 * 幂等补列：为 Product 新增 marketplace 审批列、Channel 新增 merchantStatus 列。
 * 生产关闭 synchronize 时用 queryRunner 幂等补列，失败仅打日志不阻塞启动。
 */
let MarketplaceCustomColumnMigration = class MarketplaceCustomColumnMigration {
    constructor(connection) {
        this.connection = connection;
        // 列名规则：customFields + 首字母大写字段名（Vendure 全小写）
        this.productColumns = [
            { col: 'customFieldsListedinmarketplace', type: 'boolean' },
            { col: 'customFieldsMarketplacestatus', type: 'varchar(32)' },
            { col: 'customFieldsMerchantref', type: 'varchar(255)' },
            { col: 'customFieldsRejectreason', type: 'varchar(500)' },
        ];
        this.channelColumn = { col: 'customFieldsMerchantstatus', type: 'varchar(32)' };
    }
    async onApplicationBootstrap() {
        try {
            const productTable = this.connection.getMetadata('Product').tableName;
            const channelTable = this.connection.getMetadata('Channel').tableName;
            const qr = this.connection.createQueryRunner();
            try {
                for (const c of this.productColumns) {
                    if (!(await qr.hasColumn(productTable, c.col))) {
                        await qr.addColumn(productTable, new typeorm_2.TableColumn({ name: c.col, type: c.type, isNullable: true, default: c.type === 'boolean' ? false : undefined }));
                    }
                }
                if (!(await qr.hasColumn(channelTable, this.channelColumn.col))) {
                    await qr.addColumn(channelTable, new typeorm_2.TableColumn({ name: this.channelColumn.col, type: this.channelColumn.type, isNullable: true }));
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[MarketplaceCustomColumnMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.MarketplaceCustomColumnMigration = MarketplaceCustomColumnMigration;
exports.MarketplaceCustomColumnMigration = MarketplaceCustomColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], MarketplaceCustomColumnMigration);
//# sourceMappingURL=migrate-marketplace-custom-column.js.map