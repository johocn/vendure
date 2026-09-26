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
exports.StocktakePostedDocIndexMigration = void 0;
// 幂等补 stocktake_task 的 (tenantChannelId, postedStockDocId) 复合索引（D44）。
// 生产 Postgres 与本地 sqlite 都关闭 synchronize，实体上的 @Index 不会自动落地，必须显式建索引。
// 用途：单据中心列表（stockDocList）按 postedStockDocId 反查任务号，无索引会退化为全表扫。
// 表名/列名不硬编码：从 TypeORM 元数据取 tableName 与 databaseName，避免 dev(sqlite)/prod(postgres) 命名策略差异。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stocktake_task_entity_1 = require("../stocktake/stocktake-task.entity");
let StocktakePostedDocIndexMigration = class StocktakePostedDocIndexMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const meta = this.connection.getMetadata(stocktake_task_entity_1.StocktakeTask);
            const tableName = meta.tableName;
            const colName = (property) => { var _a, _b; return (_b = (_a = meta.columns.find(c => c.propertyName === property)) === null || _a === void 0 ? void 0 : _a.databaseName) !== null && _b !== void 0 ? _b : property; };
            const tenantCol = colName('tenantChannelId');
            const docCol = colName('postedStockDocId');
            const runner = this.connection.createQueryRunner();
            try {
                await runner.query(`CREATE INDEX IF NOT EXISTS "idx_stocktake_task_posted_doc" ON "${tableName}" ("${tenantCol}", "${docCol}")`);
            }
            finally {
                await runner.release();
            }
        }
        catch (e) {
            // 建索引失败不阻塞启动，下次启动重试（与既有 migration 一致）
            // eslint-disable-next-line no-console
            console.error('[StocktakePostedDocIndexMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.StocktakePostedDocIndexMigration = StocktakePostedDocIndexMigration;
exports.StocktakePostedDocIndexMigration = StocktakePostedDocIndexMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], StocktakePostedDocIndexMigration);
//# sourceMappingURL=migrate-stocktake-posted-doc-index.js.map