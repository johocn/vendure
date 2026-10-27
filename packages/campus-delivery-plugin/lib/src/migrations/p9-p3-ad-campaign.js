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
exports.P9P3AdCampaignMigration = exports.p9P3AdCampaignSql = void 0;
// P2-3 批次（2026-10-27）：广告位与商家自助投放计费（按天计费）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p9P3AdCampaignSql = `
CREATE TABLE IF NOT EXISTS campus_ad_campaign (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, slot varchar(32) NOT NULL, title varchar(64) NOT NULL,
  "imageUrl" varchar(512), "linkUrl" varchar(255), "startDate" date NOT NULL, "endDate" date NOT NULL,
  days int NOT NULL, "unitPriceFen" int NOT NULL, "totalFen" int NOT NULL,
  status varchar(16) DEFAULT 'pendingPay', "payRef" varchar(64), "paidAt" timestamptz,
  "reviewNote" text, "reviewedBy" varchar(255), "reviewedAt" timestamptz, "createdBy" varchar(255));
CREATE INDEX IF NOT EXISTS idx_campus_ad_channel_slot ON campus_ad_campaign ("channelId", slot, status)
`;
let P9P3AdCampaignMigration = class P9P3AdCampaignMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p9P3AdCampaignSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P9P3AdCampaignMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P9P3AdCampaignMigration = P9P3AdCampaignMigration;
exports.P9P3AdCampaignMigration = P9P3AdCampaignMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P9P3AdCampaignMigration);
//# sourceMappingURL=p9-p3-ad-campaign.js.map