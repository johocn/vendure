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
exports.P10ReviewAlertMigration = exports.p10ReviewAlertSql = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/**
 * P4-2 评价品质闭环（2026-10-28）：差评预警规则 + 预警记录两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
exports.p10ReviewAlertSql = `
CREATE TABLE IF NOT EXISTS campus_review_alert_rule (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, enabled boolean DEFAULT true, "maxRating" int DEFAULT 2,
  "couponTemplateId" varchar(255),
  UNIQUE ("channelId"));
CREATE TABLE IF NOT EXISTS campus_review_alert (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "reviewId" int NOT NULL, "channelId" int NOT NULL, "productId" int NOT NULL, "customerId" int NOT NULL,
  rating int NOT NULL, content text NOT NULL, tags jsonb,
  "couponStatus" varchar(255) DEFAULT 'none', "couponCode" varchar(255),
  status varchar(255) DEFAULT 'new', note text, "handledAt" timestamptz,
  UNIQUE ("reviewId"));
CREATE INDEX IF NOT EXISTS idx_campus_review_alert_channel ON campus_review_alert ("channelId", status);
`;
let P10ReviewAlertMigration = class P10ReviewAlertMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p10ReviewAlertSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P10ReviewAlertMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P10ReviewAlertMigration = P10ReviewAlertMigration;
exports.P10ReviewAlertMigration = P10ReviewAlertMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P10ReviewAlertMigration);
//# sourceMappingURL=p10-review-alert.js.map