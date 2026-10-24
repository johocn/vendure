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
exports.AddRouteDeliveryConfigMigration = exports.addRouteDeliveryConfigSql = void 0;
// R1–R5 履约矩阵新增列（2026-10-23）：按路线第一段承运、校园交接点、外部快递门店编号、超时兜底、门店坐标。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补列；IF NOT EXISTS 幂等，重复启动无副作用。
// 订单侧 customFields（deliveryPlan/handoverMode/thirdParty*/handoverPoint*）由 Vendure customFields 同步负责，不在此处猜列名。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addRouteDeliveryConfigSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "routeFirstLeg" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "handoverPoints" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "providerShopNo" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "merchantAcceptMinutes" int DEFAULT 5;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "externalPushTimeoutMinutes" int DEFAULT 10;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "externalFallbackMinutes" int DEFAULT 20;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeLat" double precision;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeLng" double precision;
`;
let AddRouteDeliveryConfigMigration = class AddRouteDeliveryConfigMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.addRouteDeliveryConfigSql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 表尚未建立（首次安装先跑建表）等情况只打日志，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddRouteDeliveryConfigMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddRouteDeliveryConfigMigration = AddRouteDeliveryConfigMigration;
exports.AddRouteDeliveryConfigMigration = AddRouteDeliveryConfigMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddRouteDeliveryConfigMigration);
//# sourceMappingURL=add-route-delivery-config.js.map