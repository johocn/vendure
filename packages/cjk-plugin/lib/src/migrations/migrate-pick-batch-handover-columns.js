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
exports.PickBatchHandoverColumnMigration = void 0;
// 幂等补 pick_batch 交接/复核/异常件列
// （生产 Postgres 与本地 sqlite 都可能关闭 synchronize，必须显式补列）。
// 列名不硬编码：从 TypeORM 元数据取 databaseName，避免 dev(sqlite) / prod(postgres) 命名策略差异。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pick_batch_entity_1 = require("../picking/pick-batch.entity");
let PickBatchHandoverColumnMigration = class PickBatchHandoverColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a;
        try {
            const meta = this.connection.getMetadata(pick_batch_entity_1.PickBatch);
            const tableName = meta.tableName; // pick_batch
            const wanted = [
                { property: 'handoverAt', type: 'timestamp' },
                { property: 'handoverTo', type: 'varchar', length: 255 },
                { property: 'reviewedAt', type: 'timestamp' },
                { property: 'exceptionAt', type: 'timestamp' },
                { property: 'exceptionNote', type: 'varchar', length: 1000 },
            ];
            const runner = this.connection.createQueryRunner();
            try {
                for (const w of wanted) {
                    const col = meta.columns.find(c => c.propertyName === w.property);
                    const name = (_a = col === null || col === void 0 ? void 0 : col.databaseName) !== null && _a !== void 0 ? _a : w.property;
                    if (await runner.hasColumn(tableName, name))
                        continue;
                    await runner.addColumn(tableName, new typeorm_2.TableColumn({ name, type: w.type, length: w.length, isNullable: true }));
                    // eslint-disable-next-line no-console
                    console.log(`[PickBatchHandoverColumnMigration] added ${tableName}.${name}`);
                }
            }
            finally {
                await runner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，下次启动重试（与既有 migration 一致）
            // eslint-disable-next-line no-console
            console.error('[PickBatchHandoverColumnMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.PickBatchHandoverColumnMigration = PickBatchHandoverColumnMigration;
exports.PickBatchHandoverColumnMigration = PickBatchHandoverColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], PickBatchHandoverColumnMigration);
//# sourceMappingURL=migrate-pick-batch-handover-columns.js.map