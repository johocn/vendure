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
exports.P13AutoAcceptMigration = exports.p13AutoAcceptSql = void 0;
// §69 商家自动接单（2026-10-29）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/** 履约配置 4 个自动接单字段（simple-json 路线列存 text）+ Order.autoAcceptedAt 留痕列 */
exports.p13AutoAcceptSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptDelaySeconds" int NOT NULL DEFAULT 30;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptDailyLimit" int NOT NULL DEFAULT 0;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoAcceptRoutes" text NOT NULL DEFAULT '["R1","R2","R3"]';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsAutoacceptedat" timestamp;
`;
let P13AutoAcceptMigration = class P13AutoAcceptMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p13AutoAcceptSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            console.error('[P13AutoAcceptMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P13AutoAcceptMigration = P13AutoAcceptMigration;
exports.P13AutoAcceptMigration = P13AutoAcceptMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P13AutoAcceptMigration);
//# sourceMappingURL=p13-auto-accept.js.map