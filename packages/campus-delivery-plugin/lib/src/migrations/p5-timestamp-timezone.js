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
exports.P5TimestampTimezoneMigration = void 0;
// P5 时区修复（2026-10-24）：order.customFields*At 列从 timestamp without time zone → timestamp with time zone。
// 历史数据写入用 JS new Date()（epoch-based = UTC），PG session timezone = UTC，
// 所以存量数据就是 UTC 墙钟时间，ALTER ... AT TIME ZONE 'UTC' 无偏移语义损失。
// 修复后 TypeORM/pg 客户端读回 Date 与写入 epoch ms 严格对齐，不再出现运维脚本造测试数据偏 8 小时。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
// 从 information_schema.columns 现拉：避免硬编码遗漏未来新增的 customFields datetime 列
const discoverSql = `
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='order'
  AND data_type='timestamp without time zone'
  AND column_name LIKE 'customFields%'
ORDER BY column_name
`;
const buildAlterSql = (cols) => cols.map(c => `ALTER TABLE "order" ALTER COLUMN "${c}" TYPE timestamp with time zone USING "${c}" AT TIME ZONE 'UTC';`).join('\n');
let P5TimestampTimezoneMigration = class P5TimestampTimezoneMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a;
        const runner = this.connection.createQueryRunner();
        try {
            const rows = await runner.query(discoverSql);
            const cols = Array.isArray(rows)
                ? rows.map(r => r.column_name).filter(Boolean)
                : [];
            if (!cols.length) {
                // 已经全部转完
                return;
            }
            const sql = buildAlterSql(cols);
            await runner.query(sql);
            // eslint-disable-next-line no-console
            console.log(`[P5Migration] timestamp with time zone: migrated ${cols.length} columns → timestamptz`);
        }
        catch (e) {
            // 启动早期 migration 跑失败不阻断应用（Vendure synchronize 会兜底）
            // eslint-disable-next-line no-console
            console.warn(`[P5Migration] skipped: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`);
        }
        finally {
            await runner.release();
        }
    }
};
exports.P5TimestampTimezoneMigration = P5TimestampTimezoneMigration;
exports.P5TimestampTimezoneMigration = P5TimestampTimezoneMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P5TimestampTimezoneMigration);
//# sourceMappingURL=p5-timestamp-timezone.js.map