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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionIconMigration = void 0;
// 确保 collection 表存在 icon 自定义字段列（分类图标）。
// Vendure 自定义字段列名规则 = customFields + 首字母大写字段名，例如 icon → customFieldsIcon。
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列；
// 失败仅 console.error，不阻塞启动。
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let CollectionIconMigration = class CollectionIconMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        const qr = this.connection.rawConnection.createQueryRunner();
        try {
            const tableName = 'collection';
            const COL = 'customFieldsIcon';
            if (!(await qr.hasColumn(tableName, COL))) {
                await qr.addColumn(tableName, new typeorm_1.TableColumn({
                    name: COL,
                    type: 'varchar(255)',
                    isNullable: true,
                }));
                // eslint-disable-next-line no-console
                console.log('[CollectionIconMigration] added collection.customFieldsIcon');
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CollectionIconMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await qr.release();
        }
    }
};
exports.CollectionIconMigration = CollectionIconMigration;
exports.CollectionIconMigration = CollectionIconMigration = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], CollectionIconMigration);
//# sourceMappingURL=migrate-collection-icon.js.map