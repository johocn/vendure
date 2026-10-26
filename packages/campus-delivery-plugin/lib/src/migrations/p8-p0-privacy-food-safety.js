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
exports.P8P0Migration = exports.p8ReviewAppealSql = exports.p8P0Sql = void 0;
// P0 批次（2026-10-26）：号码保护 + 食安公示 + 在线客服 IM + 差评申诉。
// 生产 synchronize: false，启动幂等补列/建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p8P0Sql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberProvider" varchar(32) NOT NULL DEFAULT 'mask';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberTtlMinutes" int NOT NULL DEFAULT 60;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberPrefix" varchar(32);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseNo" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseImage" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseExpiry" varchar(16);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodSafetyGrade" varchar(8);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodSafetyCommitmentImage" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "kitchenLiveUrl" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "kitchenLiveEnabled" boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS campus_chat_conversation (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL,
  "customerId" int NOT NULL,
  "orderCode" varchar(64),
  subject varchar(128),
  status varchar(16) NOT NULL DEFAULT 'open',
  "lastMessage" varchar(200),
  "lastMessageAt" timestamptz,
  "lastSenderType" varchar(16),
  "unreadForCustomer" int NOT NULL DEFAULT 0,
  "unreadForAdmin" int NOT NULL DEFAULT 0,
  "closedAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_chat_conv_channel ON campus_chat_conversation ("channelId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_campus_chat_conv_customer ON campus_chat_conversation ("channelId", "customerId");
CREATE TABLE IF NOT EXISTS campus_chat_message (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "conversationId" int NOT NULL,
  "senderType" varchar(16) NOT NULL,
  "senderId" int,
  content text,
  images text,
  "readAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_chat_msg_conv ON campus_chat_message ("conversationId", id);
`;
/** review 表可能未安装 review-plugin：单独 DO 块判存在再补列 */
exports.p8ReviewAppealSql = `
DO $$
BEGIN
  IF to_regclass('review') IS NOT NULL THEN
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealStatus" varchar(16);
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReason" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealImages" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealAt" timestamptz;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealResult" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReviewedBy" varchar(64);
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReviewedAt" timestamptz;
  END IF;
END
$$;
`;
let P8P0Migration = class P8P0Migration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p8P0Sql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
                await qr.query(exports.p8ReviewAppealSql);
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P8P0Migration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P8P0Migration = P8P0Migration;
exports.P8P0Migration = P8P0Migration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P8P0Migration);
//# sourceMappingURL=p8-p0-privacy-food-safety.js.map