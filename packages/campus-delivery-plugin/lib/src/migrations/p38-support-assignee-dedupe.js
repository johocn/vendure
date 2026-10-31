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
exports.P38SupportAssigneeDedupeMigration = exports.p38SupportAssigneeDedupeSql = void 0;
// G3 系统工单自动指派值班人：工单增加 assigneeId（管理员 userId）。
// M4 跨实例去重/限频：新建 campus_dedupe_key（key 主键，expiresAt 到期时间，counter 计数，value JSON）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p38SupportAssigneeDedupeSql = `
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "assigneeId" int;
CREATE INDEX IF NOT EXISTS "IDX_campus_support_ticket_assignee"
    ON campus_support_ticket ("assigneeId") WHERE "assigneeId" IS NOT NULL;
CREATE TABLE IF NOT EXISTS campus_dedupe_key (
    "key" varchar PRIMARY KEY,
    "expiresAt" timestamptz NOT NULL,
    counter int NOT NULL DEFAULT 0,
    value jsonb
);
CREATE INDEX IF NOT EXISTS "IDX_campus_dedupe_key_expires"
    ON campus_dedupe_key ("expiresAt");
`;
let P38SupportAssigneeDedupeMigration = class P38SupportAssigneeDedupeMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p38SupportAssigneeDedupeSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P38SupportAssigneeDedupeMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P38SupportAssigneeDedupeMigration = P38SupportAssigneeDedupeMigration;
exports.P38SupportAssigneeDedupeMigration = P38SupportAssigneeDedupeMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P38SupportAssigneeDedupeMigration);
//# sourceMappingURL=p38-support-assignee-dedupe.js.map