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
exports.P11SoldOutAutoRestoreMigration = exports.p11SoldOutAutoRestoreSql = void 0;
// §66（2026-10-28）：沽清次日自动恢复。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p11SoldOutAutoRestoreSql = `
CREATE TABLE IF NOT EXISTS campus_soldout_batch (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "productId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_soldout_batch_channel_product
  ON campus_soldout_batch ("channelId", "productId");
ALTER TABLE channel ADD COLUMN IF NOT EXISTS "customFieldsWaimaisoldoutautorestore" boolean DEFAULT true;
`;
let P11SoldOutAutoRestoreMigration = class P11SoldOutAutoRestoreMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p11SoldOutAutoRestoreSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P11SoldOutAutoRestoreMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P11SoldOutAutoRestoreMigration = P11SoldOutAutoRestoreMigration;
exports.P11SoldOutAutoRestoreMigration = P11SoldOutAutoRestoreMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P11SoldOutAutoRestoreMigration);
//# sourceMappingURL=p11-soldout-auto-restore.js.map