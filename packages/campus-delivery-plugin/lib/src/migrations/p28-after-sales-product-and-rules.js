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
exports.P28AfterSalesProductAndRulesMigration = exports.p28AfterSalesProductAndRulesSql = void 0;
// §98（2026-10-31）：商品维度售后分析所需审计列 + 退货物流轨迹 + 自动分流规则 + 评价标签。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p28AfterSalesProductAndRulesSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "autoRuleAppliedAt" timestamptz;
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "autoRuleId" integer;
CREATE TABLE IF NOT EXISTS campus_after_sales_return_logistics (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  status varchar(16) NOT NULL,
  description varchar(200),
  "occurredAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" integer
);
CREATE INDEX IF NOT EXISTS campus_after_sales_return_logistics_request
  ON campus_after_sales_return_logistics ("channelId", "requestId", "occurredAt");
CREATE TABLE IF NOT EXISTS campus_after_sales_auto_rule (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  name varchar(100) NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  "matchType" varchar(16) NOT NULL DEFAULT '*',
  "matchReason" varchar(200),
  "minAmount" integer,
  "maxAmount" integer,
  action varchar(16) NOT NULL,
  "rejectReason" varchar(200)
);
CREATE INDEX IF NOT EXISTS campus_after_sales_auto_rule_channel
  ON campus_after_sales_auto_rule ("channelId", enabled, priority);
ALTER TABLE campus_after_sales_review ADD COLUMN IF NOT EXISTS tags text;
`;
let P28AfterSalesProductAndRulesMigration = class P28AfterSalesProductAndRulesMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p28AfterSalesProductAndRulesSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P28AfterSalesProductAndRulesMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P28AfterSalesProductAndRulesMigration = P28AfterSalesProductAndRulesMigration;
exports.P28AfterSalesProductAndRulesMigration = P28AfterSalesProductAndRulesMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P28AfterSalesProductAndRulesMigration);
//# sourceMappingURL=p28-after-sales-product-and-rules.js.map