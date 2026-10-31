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
exports.P31NotifyHandoverFallbackMigration = exports.p31NotifyHandoverFallbackSql = void 0;
// §4/§5（2026-10-31）：用户侧新增两个通知触点模板字段。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p31NotifyHandoverFallbackSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateArrivedHandover" varchar;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateDeliveryFallback" varchar;
`;
let P31NotifyHandoverFallbackMigration = class P31NotifyHandoverFallbackMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p31NotifyHandoverFallbackSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P31NotifyHandoverFallbackMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P31NotifyHandoverFallbackMigration = P31NotifyHandoverFallbackMigration;
exports.P31NotifyHandoverFallbackMigration = P31NotifyHandoverFallbackMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P31NotifyHandoverFallbackMigration);
//# sourceMappingURL=p31-notify-handover-fallback.js.map