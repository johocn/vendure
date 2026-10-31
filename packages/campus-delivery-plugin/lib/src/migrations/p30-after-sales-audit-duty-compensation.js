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
exports.P30AfterSalesAuditDutyCompensationMigration = exports.p30AfterSalesAuditDutyCompensationSql = void 0;
// §100（2026-10-31）：售后操作审计留痕表 + 值班排班表 + 补偿挽留方案表。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p30AfterSalesAuditDutyCompensationSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_audit_log (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  action varchar(32) NOT NULL,
  "actorUserId" integer,
  "actorName" varchar(100),
  detail varchar(500)
);
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_request
  ON campus_after_sales_audit_log ("channelId", "requestId", "createdAt");
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_channel
  ON campus_after_sales_audit_log ("channelId", "createdAt");
CREATE TABLE IF NOT EXISTS campus_after_sales_duty (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  weekday smallint NOT NULL,
  "startMin" integer NOT NULL,
  "endMin" integer NOT NULL,
  "userId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_duty_unique
  ON campus_after_sales_duty ("channelId", weekday, "startMin", "endMin", "userId");
CREATE INDEX IF NOT EXISTS campus_after_sales_duty_channel
  ON campus_after_sales_duty ("channelId", weekday, "startMin");
CREATE TABLE IF NOT EXISTS campus_after_sales_compensation_plan (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  name varchar(100) NOT NULL,
  "refundAmount" integer NOT NULL DEFAULT 0,
  "couponTemplateId" varchar(255),
  note varchar(200),
  enabled boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS campus_after_sales_compensation_plan_channel
  ON campus_after_sales_compensation_plan ("channelId", enabled);
`;
let P30AfterSalesAuditDutyCompensationMigration = class P30AfterSalesAuditDutyCompensationMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p30AfterSalesAuditDutyCompensationSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P30AfterSalesAuditDutyCompensationMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P30AfterSalesAuditDutyCompensationMigration = P30AfterSalesAuditDutyCompensationMigration;
exports.P30AfterSalesAuditDutyCompensationMigration = P30AfterSalesAuditDutyCompensationMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P30AfterSalesAuditDutyCompensationMigration);
//# sourceMappingURL=p30-after-sales-audit-duty-compensation.js.map