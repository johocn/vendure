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
exports.P32CampusConfigMissingColumnsMigration = exports.p32CampusConfigMissingColumnsSql = void 0;
// P1 F11（2026-10-31）：补齐配置表历史遗漏列 + 公告列扩容。
// 生产 synchronize:false，这些列靠手工 SQL 存在；新环境/灾备重建时缺列会让配置查询直接报
// column does not exist。迁移幂等（IF NOT EXISTS / 加宽安全），随服务启动执行。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p32CampusConfigMissingColumnsSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "freeShippingThreshold" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationEnabled" boolean DEFAULT true;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutGraceMinutes" int DEFAULT 10;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationCouponTemplateId" varchar;
ALTER TABLE campus_fulfillment_config ALTER COLUMN "storeNotice" TYPE varchar(500);
`;
let P32CampusConfigMissingColumnsMigration = class P32CampusConfigMissingColumnsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p32CampusConfigMissingColumnsSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P32CampusConfigMissingColumnsMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P32CampusConfigMissingColumnsMigration = P32CampusConfigMissingColumnsMigration;
exports.P32CampusConfigMissingColumnsMigration = P32CampusConfigMissingColumnsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P32CampusConfigMissingColumnsMigration);
//# sourceMappingURL=p32-campus-config-missing-columns.js.map