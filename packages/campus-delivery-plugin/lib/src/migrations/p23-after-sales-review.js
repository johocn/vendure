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
exports.P23AfterSalesReviewMigration = exports.p23AfterSalesReviewSql = void 0;
// §93（2026-10-31）：退款后满意度回访（顾客 1-5 分 + 留言，商家低分跟进）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p23AfterSalesReviewSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_review (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "customerId" integer NOT NULL,
  "score" integer NOT NULL,
  "comment" text,
  "followedUp" boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_review_request
  ON campus_after_sales_review ("requestId");
CREATE INDEX IF NOT EXISTS campus_after_sales_review_channel
  ON campus_after_sales_review ("channelId", "createdAt");
`;
let P23AfterSalesReviewMigration = class P23AfterSalesReviewMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p23AfterSalesReviewSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P23AfterSalesReviewMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P23AfterSalesReviewMigration = P23AfterSalesReviewMigration;
exports.P23AfterSalesReviewMigration = P23AfterSalesReviewMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P23AfterSalesReviewMigration);
//# sourceMappingURL=p23-after-sales-review.js.map