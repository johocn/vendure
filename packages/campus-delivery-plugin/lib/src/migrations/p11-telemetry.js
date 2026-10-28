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
exports.P11TelemetryMigration = exports.p11TelemetrySql = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/**
 * P4-4 前端埋点与错误上报（2026-10-28）：行为事件 + 错误报告两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
exports.p11TelemetrySql = `
CREATE TABLE IF NOT EXISTS campus_track_event (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "customerId" int, "sessionId" varchar(64),
  "eventName" varchar(64) NOT NULL, page varchar(128), props jsonb, ua varchar(255), ip varchar(64));
CREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_time ON campus_track_event ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_name ON campus_track_event ("channelId", "eventName");
CREATE TABLE IF NOT EXISTS campus_error_report (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, source varchar(16) NOT NULL, level varchar(16) NOT NULL DEFAULT 'error',
  message text NOT NULL, stack text, page varchar(128), url varchar(500), ua varchar(255), "customerId" int);
CREATE INDEX IF NOT EXISTS idx_campus_error_report_channel_time ON campus_error_report ("channelId", "createdAt");
`;
let P11TelemetryMigration = class P11TelemetryMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p11TelemetrySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P11TelemetryMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P11TelemetryMigration = P11TelemetryMigration;
exports.P11TelemetryMigration = P11TelemetryMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P11TelemetryMigration);
//# sourceMappingURL=p11-telemetry.js.map