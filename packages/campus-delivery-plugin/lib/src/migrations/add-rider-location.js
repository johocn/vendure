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
exports.AddRiderLocationMigration = exports.addRiderLocationSql = void 0;
// P8-4 骑手轨迹留存（2026-10-25）：实时位置原先只写在 order.customFields（送达即清空），
// 无法事后追溯配送路线。新增 campus_rider_location 历史表（配送中每 10s 一条，30 天清理）。
// 同时为分成台账补两个具名索引（后台按渠道/骑手倒序分页查询）。
// 生产 synchronize: false，启动幂等建表/建索引（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addRiderLocationSql = `
CREATE TABLE IF NOT EXISTS campus_rider_location (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL,
  "orderId" int NOT NULL,
  "riderCustomerId" int NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  "reportedAt" timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campus_rider_location_order ON campus_rider_location ("orderId", "reportedAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_location_rider ON campus_rider_location ("channelId", "riderCustomerId", "reportedAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_earning_channel_created ON rider_earning ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_earning_rider_created ON rider_earning ("riderCustomerId", "createdAt");
`;
let AddRiderLocationMigration = class AddRiderLocationMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const statements = exports.addRiderLocationSql
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
            console.error('[AddRiderLocationMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddRiderLocationMigration = AddRiderLocationMigration;
exports.AddRiderLocationMigration = AddRiderLocationMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddRiderLocationMigration);
//# sourceMappingURL=add-rider-location.js.map