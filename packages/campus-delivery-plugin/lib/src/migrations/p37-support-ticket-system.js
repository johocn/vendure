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
exports.P37SupportTicketSystemMigration = exports.p37SupportTicketSystemSql = void 0;
// R7 外部运单异常转工单：工单支持系统来源与幂等键；系统工单无顾客（customerId 可空）。
// 同时补订单 customFields.exceptionResolvedAt 物理列（工单关闭后回写，调度不再重复告警）。
// 物理列名规则：自定义字段 = customFields + 首字母大写 + 其余小写。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p37SupportTicketSystemSql = `
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'customer';
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "dedupeKey" varchar;
ALTER TABLE campus_support_ticket
    ALTER COLUMN "customerId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campus_support_ticket_dedupe"
    ON campus_support_ticket ("dedupeKey") WHERE "dedupeKey" IS NOT NULL;
ALTER TABLE "order"
    ADD COLUMN IF NOT EXISTS "customFieldsExceptionresolvedat" timestamptz;
`;
let P37SupportTicketSystemMigration = class P37SupportTicketSystemMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p37SupportTicketSystemSql
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
            console.error('[P37SupportTicketSystemMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P37SupportTicketSystemMigration = P37SupportTicketSystemMigration;
exports.P37SupportTicketSystemMigration = P37SupportTicketSystemMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P37SupportTicketSystemMigration);
//# sourceMappingURL=p37-support-ticket-system.js.map