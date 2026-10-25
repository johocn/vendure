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
exports.AddWithdrawPayoutMigration = exports.addWithdrawPayoutSql = void 0;
// P2-2 提现打款留痕（2026-10-25）：通过提现时必须登记打款流水号/凭证；
// P3-1 接单班次校验开关（per-store 配置列）；
// P3-2 黑名单自动规则阈值 + 订单取消归因列（customFields 在 PG 中是独立列）。
// P8-1 补建表：本表历史上靠手工/同步创建，迁移目录缺 CREATE TABLE，新环境/灾备冷启动 ALTER 会失败；
// P8-2 打款失败回退：FAILED 状态 + failReason 留痕。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addWithdrawPayoutSql = `
CREATE TABLE IF NOT EXISTS rider_withdrawal_request (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "customerId" int NOT NULL,
  "channelId" int NOT NULL,
  amount int NOT NULL,
  channel varchar(255) NOT NULL,
  account varchar(255) NOT NULL,
  status varchar(255) DEFAULT 'PENDING',
  remark varchar(255),
  "reviewedBy" varchar(255),
  "reviewedAt" timestamp,
  "payoutRef" varchar(255),
  "payoutProof" varchar(255),
  "failReason" varchar(255));
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "payoutRef" varchar(255);
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "payoutProof" varchar(255);
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "failReason" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "shiftCheckEnabled" boolean DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "blacklistAutoCancelCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsCampuscancelcause" varchar(255);
`;
let AddWithdrawPayoutMigration = class AddWithdrawPayoutMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const statements = exports.addWithdrawPayoutSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean);
                for (const statement of statements) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddWithdrawPayoutMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddWithdrawPayoutMigration = AddWithdrawPayoutMigration;
exports.AddWithdrawPayoutMigration = AddWithdrawPayoutMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddWithdrawPayoutMigration);
//# sourceMappingURL=add-withdraw-payout.js.map