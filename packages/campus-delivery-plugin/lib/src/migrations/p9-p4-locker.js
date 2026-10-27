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
exports.P9P4LockerMigration = exports.p9P4LockerSql = void 0;
// P2-4 批次（2026-10-27）：智能取餐柜站点 + 无人配送通道配置（接口占位）。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p9P4LockerSql = `
CREATE TABLE IF NOT EXISTS campus_locker_station (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, name varchar(64) NOT NULL, location varchar(255) NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'self', "totalCells" int NOT NULL DEFAULT 0,
  "availableCells" int NOT NULL DEFAULT 0, "openHours" varchar(32), "pickupGuide" text,
  enabled boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0, "createdBy" varchar(255));
CREATE INDEX IF NOT EXISTS idx_campus_locker_channel ON campus_locker_station ("channelId", enabled);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryProvider" varchar(16) NOT NULL DEFAULT 'mock';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryEndpoint" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryKey" varchar(128)
`;
let P9P4LockerMigration = class P9P4LockerMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p9P4LockerSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P9P4LockerMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P9P4LockerMigration = P9P4LockerMigration;
exports.P9P4LockerMigration = P9P4LockerMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P9P4LockerMigration);
//# sourceMappingURL=p9-p4-locker.js.map