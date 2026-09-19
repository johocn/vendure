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
exports.ChannelInventoryModeColumnMigration = exports.StockTableMigration = void 0;
// 生产（PostgreSQL）与本地开发（SQLite）均关闭 synchronize，不会自动建表/加列。
// 此处按 cjk-plugin 既有的 OnApplicationBootstrap 幂等 migration 模式，
// 显式补建 4 张库存表（stock_doc / stock_doc_item / stock_reservation / stock_reservation_item）
// 与 Channel 的 inventoryMode / odooBaseUrl / odooApiKey 三个自定义字段列。
// 幂等由 IF NOT EXISTS / hasColumn 保证；失败仅 console.error，不阻塞启动。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
function isSqlite(driver) {
    return driver === 'sqlite' || driver === 'better-sqlite3' || driver === 'sqljs' || driver === 'expo';
}
function isPostgres(driver) {
    return driver === 'postgres' || driver === 'postgresql';
}
/**
 * 幂等补建 4 张库存表。列与实体 field 完全对齐（含 unique / 索引 / 默认值）。
 */
let StockTableMigration = class StockTableMigration {
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
            const statements = [];
            // stock_doc（code 列 unique）
            statements.push(`CREATE TABLE IF NOT EXISTS ${'stock_doc'} (` +
                `${Q('id')} ${pk}, ` +
                `${Q('type')} varchar(255) NOT NULL, ` +
                `${Q('tenantChannelId')} varchar(255) NOT NULL, ` +
                `${Q('code')} varchar(255) NOT NULL UNIQUE, ` +
                `${Q('remark')} text NULL, ` +
                `${Q('operator')} varchar(255) NULL, ` +
                `${Q('createdAt')} ${datetime} NOT NULL)`);
            // stock_doc_item（无 createdAt）
            statements.push(`CREATE TABLE IF NOT EXISTS ${'stock_doc_item'} (` +
                `${Q('id')} ${pk}, ` +
                `${Q('docId')} integer NOT NULL, ` +
                `${Q('variantId')} integer NOT NULL, ` +
                `${Q('fromStockLocationId')} integer NULL, ` +
                `${Q('toStockLocationId')} integer NULL, ` +
                `${Q('qty')} integer NOT NULL DEFAULT 0, ` +
                `${Q('realQty')} integer NULL, ` +
                `${Q('costPrice')} integer NULL, ` +
                `${Q('difference')} integer NOT NULL DEFAULT 0)`);
            // stock_reservation（orderId 有 @Index()）
            statements.push(`CREATE TABLE IF NOT EXISTS ${'stock_reservation'} (` +
                `${Q('id')} ${pk}, ` +
                `${Q('orderId')} integer NOT NULL, ` +
                `${Q('orderLineId')} integer NULL, ` +
                `${Q('variantId')} integer NOT NULL, ` +
                `${Q('totalQty')} integer NOT NULL, ` +
                `${Q('status')} varchar(255) NOT NULL, ` +
                `${Q('tenantChannelId')} varchar(255) NULL, ` +
                `${Q('createdAt')} ${datetime} NOT NULL)`);
            statements.push(`CREATE INDEX IF NOT EXISTS ${'idx_stock_reservation_orderId'} ON ${'stock_reservation'} (${Q('orderId')})`);
            // stock_reservation_item（无 createdAt）
            statements.push(`CREATE TABLE IF NOT EXISTS ${'stock_reservation_item'} (` +
                `${Q('id')} ${pk}, ` +
                `${Q('reservationId')} integer NOT NULL, ` +
                `${Q('stockLocationId')} integer NOT NULL, ` +
                `${Q('qty')} integer NOT NULL, ` +
                `${Q('fulfillType')} varchar(255) NOT NULL, ` +
                `${Q('status')} varchar(255) NOT NULL)`);
            for (const stmt of statements) {
                await queryRunner.query(stmt);
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[StockTableMigration] failed to ensure stock tables:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.StockTableMigration = StockTableMigration;
exports.StockTableMigration = StockTableMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], StockTableMigration);
/**
 * 幂等补 Channel 的 3 个库存模式/odoo 自定义字段列。
 */
let ChannelInventoryModeColumnMigration = class ChannelInventoryModeColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('Channel');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const ensure = async (name, type) => {
                    if (!(await queryRunner.hasColumn(tableName, name))) {
                        await queryRunner.addColumn(tableName, new typeorm_2.TableColumn({ name, type, isNullable: true }));
                    }
                };
                // Vendure 列命名：customFields + 首字母大写字段名
                await ensure('customFieldsInventorymode', 'varchar(255)');
                await ensure('customFieldsOdoobaseurl', 'varchar(255)');
                await ensure('customFieldsOdooapikey', 'varchar(255)');
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[ChannelInventoryModeColumnMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.ChannelInventoryModeColumnMigration = ChannelInventoryModeColumnMigration;
exports.ChannelInventoryModeColumnMigration = ChannelInventoryModeColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], ChannelInventoryModeColumnMigration);
//# sourceMappingURL=migrate-stock-tables.js.map