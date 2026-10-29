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
exports.P12DailyLimitMigration = exports.p12DailyLimitSql = void 0;
// §68 菜品每日限量 / 每人限购（2026-10-29）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/** Product.waimaiDailyLimit / waimaiPerUserLimit → 物理列（TypeORM 对 customFields 转小写） */
exports.p12DailyLimitSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailylimit" int;
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaiperuserlimit" int;
`;
let P12DailyLimitMigration = class P12DailyLimitMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p12DailyLimitSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P12DailyLimitMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P12DailyLimitMigration = P12DailyLimitMigration;
exports.P12DailyLimitMigration = P12DailyLimitMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P12DailyLimitMigration);
//# sourceMappingURL=p12-daily-limit.js.map