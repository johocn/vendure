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
exports.P8P1_4CloudPrintMigration = exports.p8P1_4PrintJobSql = exports.p8P1_4ConfigSql = void 0;
// P1-4 批次（2026-10-27）：云打印（飞鹅/易联云）+ 打印任务留痕。
// 生产 synchronize: false，启动幂等补列/建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/** 店铺级打印通道配置（campus_fulfillment_config） */
exports.p8P1_4ConfigSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printProvider" varchar(16) NOT NULL DEFAULT 'local';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printAccount" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printDeviceSn" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printDeviceKey" varchar(128);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printCopies" int NOT NULL DEFAULT 1;
`;
/** 打印任务留痕：每次云打印（含测试打印）落一条，排障/重打依据 */
exports.p8P1_4PrintJobSql = `
CREATE TABLE IF NOT EXISTS campus_print_job (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "orderId" int, "channelId" int NOT NULL, provider varchar(16) NOT NULL, "deviceSn" varchar(64),
  status varchar(16) NOT NULL DEFAULT 'pending', "triggerType" varchar(16) NOT NULL,
  copies int NOT NULL DEFAULT 1, "dryRun" boolean NOT NULL DEFAULT false,
  "errorMessage" varchar(500), "durationMs" int, content text);
CREATE INDEX IF NOT EXISTS "IDX_campus_print_job_channel_created"
  ON campus_print_job ("channelId", "createdAt" DESC);
`;
let P8P1_4CloudPrintMigration = class P8P1_4CloudPrintMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [exports.p8P1_4ConfigSql, exports.p8P1_4PrintJobSql]) {
                    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
                        await qr.query(statement);
                    }
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P8P1_4CloudPrintMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P8P1_4CloudPrintMigration = P8P1_4CloudPrintMigration;
exports.P8P1_4CloudPrintMigration = P8P1_4CloudPrintMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P8P1_4CloudPrintMigration);
//# sourceMappingURL=p8-p1-4-cloud-print-kds.js.map