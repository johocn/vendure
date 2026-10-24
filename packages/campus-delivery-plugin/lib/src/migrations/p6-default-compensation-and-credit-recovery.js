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
exports.P6DefaultCompensationMigration = exports.p6DefaultCompensationSql = exports.p6ClaimSql = exports.P6_MARKER = void 0;
// P6 运营默认值 + 骑手信用自动恢复（2026-10-24）
// - 超时赔付默认开（entity default 已改 true；这里把已有 false 行也翻成 true）
// - 缺券模板时 sweepTimeoutCompensation 已有限频告警（L796-804）
// - 骑手信用自动恢复由 RiderCreditService.sweepRecovery() 实现（每轮 dispatch sweep 调用）
//
// 一次性语义：本类挂 OnApplicationBootstrap 每次启动都会跑，数据翻写必须只执行一次，
// 否则运营在后台关掉超时赔付后，下次重启/部署会被再翻回 TRUE（自动发券=真金白银）。
// 用 marker 表先抢占任务名，抢到才执行 UPDATE，之后永不再跑。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.P6_MARKER = 'p6-default-compensation';
exports.p6ClaimSql = `
CREATE TABLE IF NOT EXISTS campus_migration_marker (
  name varchar(255) PRIMARY KEY, "appliedAt" timestamptz DEFAULT now());
INSERT INTO campus_migration_marker(name) VALUES ('${exports.P6_MARKER}')
ON CONFLICT (name) DO NOTHING
RETURNING name;
`;
exports.p6DefaultCompensationSql = `
-- 超时赔付默认开：entity default 已改 true，这里把已有 FALSE 行翻成 TRUE
-- 缺券模板时 sweepTimeoutCompensation 会限频告警，不会实际赔付
UPDATE campus_fulfillment_config
SET "timeoutCompensationEnabled" = TRUE
WHERE "timeoutCompensationEnabled" = FALSE;
`;
let P6DefaultCompensationMigration = class P6DefaultCompensationMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const claimed = await qr.query(exports.p6ClaimSql);
                const rows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
                // 未抢到 marker = 已执行过（运营后续的关闭要保留），直接跳过
                if (!Array.isArray(rows) || !rows.length)
                    return;
                await qr.query(exports.p6DefaultCompensationSql);
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P6DefaultCompensationMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P6DefaultCompensationMigration = P6DefaultCompensationMigration;
exports.P6DefaultCompensationMigration = P6DefaultCompensationMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P6DefaultCompensationMigration);
//# sourceMappingURL=p6-default-compensation-and-credit-recovery.js.map