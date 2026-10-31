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
exports.P26AfterSalesEscalationAutomationMigration = exports.p26AfterSalesEscalationAutomationSql = void 0;
// §96（2026-10-31）：售后 SLA 暂停原因与时间线 + 平台仲裁升级 + 自动分配/异常预警配置。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p26AfterSalesEscalationAutomationSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedReason" varchar(200);
CREATE TABLE IF NOT EXISTS campus_after_sales_sla_pause (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason varchar(200) NOT NULL,
  "pausedAt" timestamptz NOT NULL DEFAULT now(),
  "resumedAt" timestamptz,
  "pausedMs" bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campus_after_sales_sla_pause_request
  ON campus_after_sales_sla_pause ("channelId", "requestId");
CREATE TABLE IF NOT EXISTS campus_after_sales_escalation (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason varchar(200) NOT NULL,
  priority varchar(8) NOT NULL DEFAULT 'normal',
  status varchar(16) NOT NULL DEFAULT 'Open',
  "createdBy" integer,
  "resolvedAt" timestamptz,
  resolution text
);
CREATE INDEX IF NOT EXISTS campus_after_sales_escalation_channel
  ON campus_after_sales_escalation ("channelId", status);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_escalation_open
  ON campus_after_sales_escalation ("requestId") WHERE status = 'Open';
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesautoassignenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesautoassignmax" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertrefundrate" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertoverduecount" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertlastday" varchar(10);
`;
let P26AfterSalesEscalationAutomationMigration = class P26AfterSalesEscalationAutomationMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p26AfterSalesEscalationAutomationSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P26AfterSalesEscalationAutomationMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P26AfterSalesEscalationAutomationMigration = P26AfterSalesEscalationAutomationMigration;
exports.P26AfterSalesEscalationAutomationMigration = P26AfterSalesEscalationAutomationMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P26AfterSalesEscalationAutomationMigration);
//# sourceMappingURL=p26-after-sales-escalation-automation.js.map