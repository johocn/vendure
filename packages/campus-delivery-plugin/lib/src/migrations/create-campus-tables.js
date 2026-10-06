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
exports.CreateCampusTablesMigration = exports.createCampusTables = void 0;
// 幂等建 campus 表：campus_zone / campus_building / rider_earning / campus_fulfillment_config /
// delivery_slot / rider_credit_log，并为 campus_fulfillment_config 补 plan3 新列。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补建；SQL 为 PG 专用，IF NOT EXISTS 幂等。
// 挂载机制与 coupon-plugin 一致：@Injectable + OnApplicationBootstrap，注册进 plugin providers，
// 出错只打日志不抛错、不阻塞启动，等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.createCampusTables = `
CREATE TABLE IF NOT EXISTS campus_zone (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  name varchar(255) NOT NULL, fee int NOT NULL DEFAULT 0, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS campus_building (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  name varchar(255) NOT NULL, detail varchar(255), "zoneId" int NOT NULL, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS rider_earning (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "orderId" int NOT NULL, "riderCustomerId" int NOT NULL,
  amount int NOT NULL, tip int NOT NULL DEFAULT 0, status varchar(255) DEFAULT 'credited', "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS campus_fulfillment_config (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL UNIQUE, "routesEnabled" jsonb, "riderCommissionRate" int DEFAULT 100,
  "autoAssignMinutes" int DEFAULT 10, paused boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS delivery_slot (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "slotDate" date NOT NULL, "startTime" varchar(255) NOT NULL, "endTime" varchar(255) NOT NULL,
  "zoneId" int, capacity int NOT NULL DEFAULT 20, "lockedCount" int NOT NULL DEFAULT 0,
  active boolean DEFAULT true, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS rider_credit_log (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "customerId" int NOT NULL, delta int NOT NULL, reason varchar(255) NOT NULL,
  "orderId" int, "channelId" int NOT NULL);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoRefundMinutes" int DEFAULT 30;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "inProgressSlaMinutes" int DEFAULT 45;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "compensationCouponTemplateId" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "deliveryMinutes" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "minOrderAmount" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "deliveryFee" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeAddress" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storePhone" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeNotice" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "errandBaseFee" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "merchantConfirmEnabled" boolean DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "merchantAutoOpenMinutes" int DEFAULT 15;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateAccepted" varchar;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateRiderAssigned" varchar;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateCookingDone" varchar;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateDelivered" varchar;
`;
let CreateCampusTablesMigration = class CreateCampusTablesMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const statements = exports.createCampusTables
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                for (const statement of statements) {
                    await queryRunner.query(statement);
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCampusTablesMigration] failed to ensure tables:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateCampusTablesMigration = CreateCampusTablesMigration;
exports.CreateCampusTablesMigration = CreateCampusTablesMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateCampusTablesMigration);
//# sourceMappingURL=create-campus-tables.js.map