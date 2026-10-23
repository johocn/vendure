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
exports.AddAddressChangePricingMigration = exports.addAddressChangeActorSql = exports.addAddressChangePricingSql = void 0;
// 改址 + 动态计价新增结构（2026-10-23）：
// 1) 台账表 campus_address_change（多退少补流水）
// 2) campus_fulfillment_config.dynamicPricing（动态计价 JSON 配置）
// 3) order."customFieldsDeliverydetail"（改址后的门牌/详细地址，覆盖下单地址展示）
// IF NOT EXISTS 幂等，生产关闭 synchronize 时启动补列/补表。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addAddressChangePricingSql = `
CREATE TABLE IF NOT EXISTS campus_address_change (
    "id" serial PRIMARY KEY,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    "channelId" int NOT NULL,
    "orderId" int NOT NULL,
    "orderCode" varchar NOT NULL,
    "customerId" int,
    "fromZone" varchar NOT NULL,
    "fromBuilding" varchar NOT NULL,
    "fromDetail" varchar,
    "toZone" varchar NOT NULL,
    "toBuilding" varchar NOT NULL,
    "toDetail" varchar,
    "oldFee" int NOT NULL DEFAULT 0,
    "newFee" int NOT NULL DEFAULT 0,
    "diff" int NOT NULL DEFAULT 0,
    "status" varchar NOT NULL DEFAULT 'pending',
    "settledAt" timestamp,
    "settledBy" int,
    "settleAction" varchar
);
CREATE INDEX IF NOT EXISTS idx_campus_address_change_channel ON campus_address_change ("channelId", "status");
CREATE INDEX IF NOT EXISTS idx_campus_address_change_order ON campus_address_change ("orderId");
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "dynamicPricing" jsonb;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsDeliverydetail" varchar;
`;
/** 改址台账增补：来源/原因/操作人（2026-10-23 运营代改址） */
exports.addAddressChangeActorSql = `
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "source" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "reason" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "changedBy" int;
`;
let AddAddressChangePricingMigration = class AddAddressChangePricingMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.addAddressChangePricingSql);
                await queryRunner.query(exports.addAddressChangeActorSql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddAddressChangePricingMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddAddressChangePricingMigration = AddAddressChangePricingMigration;
exports.AddAddressChangePricingMigration = AddAddressChangePricingMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddAddressChangePricingMigration);
//# sourceMappingURL=add-address-change-pricing.js.map