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
exports.P24AfterSalesRiskFollowupMigration = exports.p24AfterSalesRiskFollowupSql = void 0;
// §94（2026-10-31）：售后风险标记 + 顾客回访记录。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p24AfterSalesRiskFollowupSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_risk (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_risk_request
  ON campus_after_sales_risk ("requestId");
CREATE INDEX IF NOT EXISTS campus_after_sales_risk_channel
  ON campus_after_sales_risk ("channelId", active);
CREATE TABLE IF NOT EXISTS campus_after_sales_followup (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "operatorUserId" integer,
  method varchar NOT NULL,
  result varchar NOT NULL,
  note text,
  "nextAt" timestamptz
);
CREATE INDEX IF NOT EXISTS campus_after_sales_followup_request
  ON campus_after_sales_followup ("channelId", "requestId");
`;
let P24AfterSalesRiskFollowupMigration = class P24AfterSalesRiskFollowupMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p24AfterSalesRiskFollowupSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P24AfterSalesRiskFollowupMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P24AfterSalesRiskFollowupMigration = P24AfterSalesRiskFollowupMigration;
exports.P24AfterSalesRiskFollowupMigration = P24AfterSalesRiskFollowupMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P24AfterSalesRiskFollowupMigration);
//# sourceMappingURL=p24-after-sales-risk-followup.js.map