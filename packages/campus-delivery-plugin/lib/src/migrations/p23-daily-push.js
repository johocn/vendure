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
exports.P23DailyPushMigration = exports.p23DailyPushSql = void 0;
// §86 每日日报推送（2026-10-31）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
// 列名遵循 Vendure 自定义字段规则：customFields + 首字母大写、其余小写（与 p13 一致）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p23DailyPushSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushtime" varchar(5);
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushlastdate" varchar(10);
`;
let P23DailyPushMigration = class P23DailyPushMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p23DailyPushSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            console.error('[P23DailyPushMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P23DailyPushMigration = P23DailyPushMigration;
exports.P23DailyPushMigration = P23DailyPushMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P23DailyPushMigration);
//# sourceMappingURL=p23-daily-push.js.map