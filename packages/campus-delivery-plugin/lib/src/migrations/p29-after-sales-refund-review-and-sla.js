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
exports.P29AfterSalesRefundReviewAndSlaMigration = exports.p29AfterSalesRefundReviewAndSlaSql = void 0;
// §99（2026-10-31）：大额退款二次复核表 + 转交原因列 + SLA 营业时段截止时间列。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p29AfterSalesRefundReviewAndSlaSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaDeadlineAt" timestamptz;
ALTER TABLE campus_after_sales_assign_log ADD COLUMN IF NOT EXISTS reason varchar(200);
CREATE TABLE IF NOT EXISTS campus_after_sales_refund_review (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  amount integer NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'Pending',
  "requestedBy" integer,
  "requestedAt" timestamptz NOT NULL DEFAULT now(),
  "reviewedBy" integer,
  "reviewedAt" timestamptz,
  note varchar(200)
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_refund_review_pending
  ON campus_after_sales_refund_review ("channelId", "requestId") WHERE status = 'Pending';
CREATE INDEX IF NOT EXISTS campus_after_sales_refund_review_channel
  ON campus_after_sales_refund_review ("channelId", status, "createdAt");
`;
let P29AfterSalesRefundReviewAndSlaMigration = class P29AfterSalesRefundReviewAndSlaMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p29AfterSalesRefundReviewAndSlaSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P29AfterSalesRefundReviewAndSlaMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P29AfterSalesRefundReviewAndSlaMigration = P29AfterSalesRefundReviewAndSlaMigration;
exports.P29AfterSalesRefundReviewAndSlaMigration = P29AfterSalesRefundReviewAndSlaMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P29AfterSalesRefundReviewAndSlaMigration);
//# sourceMappingURL=p29-after-sales-refund-review-and-sla.js.map