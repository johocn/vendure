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
exports.P34ChannelAfterSalesReviewThresholdMigration = exports.p34ChannelAfterSalesReviewThresholdSql = void 0;
// F11 补漏（2026-10-31 静态差集检查发现）：Channel.waimaiAfterSalesReviewThreshold（大额退款二次复核阈值）
// 历史上只在开发环境随 schema 同步建列，迁移目录缺失；新环境/灾备重建会缺列。
// 物理列名规则：customFields + 字段名首字母大写、其余小写（TypeORM 行为）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p34ChannelAfterSalesReviewThresholdSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesreviewthreshold" int;
`;
let P34ChannelAfterSalesReviewThresholdMigration = class P34ChannelAfterSalesReviewThresholdMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p34ChannelAfterSalesReviewThresholdSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P34ChannelAfterSalesReviewThresholdMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P34ChannelAfterSalesReviewThresholdMigration = P34ChannelAfterSalesReviewThresholdMigration;
exports.P34ChannelAfterSalesReviewThresholdMigration = P34ChannelAfterSalesReviewThresholdMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P34ChannelAfterSalesReviewThresholdMigration);
//# sourceMappingURL=p34-channel-aftersales-review-threshold.js.map