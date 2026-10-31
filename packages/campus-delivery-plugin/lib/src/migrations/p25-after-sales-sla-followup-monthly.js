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
exports.P25AfterSalesSlaFollowupMonthlyMigration = exports.p25AfterSalesSlaFollowupMonthlySql = void 0;
// §95（2026-10-31）：售后 SLA 暂停/恢复 + 回访到期提醒 + 售后月度摘要推送。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p25AfterSalesSlaFollowupMonthlySql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedAt" timestamptz;
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedMs" bigint NOT NULL DEFAULT 0;
ALTER TABLE campus_after_sales_followup ADD COLUMN IF NOT EXISTS "remindedAt" timestamptz;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushday" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushtime" varchar(5);
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushlastmonth" varchar(7);
`;
let P25AfterSalesSlaFollowupMonthlyMigration = class P25AfterSalesSlaFollowupMonthlyMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p25AfterSalesSlaFollowupMonthlySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P25AfterSalesSlaFollowupMonthlyMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P25AfterSalesSlaFollowupMonthlyMigration = P25AfterSalesSlaFollowupMonthlyMigration;
exports.P25AfterSalesSlaFollowupMonthlyMigration = P25AfterSalesSlaFollowupMonthlyMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P25AfterSalesSlaFollowupMonthlyMigration);
//# sourceMappingURL=p25-after-sales-sla-followup-monthly.js.map