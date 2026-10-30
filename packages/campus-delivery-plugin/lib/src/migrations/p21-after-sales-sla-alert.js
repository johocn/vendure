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
exports.P21AfterSalesSlaAlertMigration = exports.p21AfterSalesSlaAlertSql = void 0;
// §90（2026-10-30）：售后 SLA 主动提醒（临期 / 超时），向本店渠道管理员发站内信。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p21AfterSalesSlaAlertSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_sla_alert (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "kind" varchar(16) NOT NULL,
  "alertedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("requestId", "kind")
);
CREATE INDEX IF NOT EXISTS campus_after_sales_sla_alert_time
  ON campus_after_sales_sla_alert ("alertedAt");
`;
let P21AfterSalesSlaAlertMigration = class P21AfterSalesSlaAlertMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p21AfterSalesSlaAlertSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P21AfterSalesSlaAlertMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P21AfterSalesSlaAlertMigration = P21AfterSalesSlaAlertMigration;
exports.P21AfterSalesSlaAlertMigration = P21AfterSalesSlaAlertMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P21AfterSalesSlaAlertMigration);
//# sourceMappingURL=p21-after-sales-sla-alert.js.map