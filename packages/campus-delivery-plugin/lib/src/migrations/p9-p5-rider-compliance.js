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
exports.P9P5RiderComplianceMigration = exports.p9P5RiderComplianceSql = void 0;
// P2-5 批次（2026-10-27）：骑手合规资料列（健康证 / 保险 / 背景调查）。
// Customer 自定义字段为物理列（命名规则：customFields + 首字母大写+其余小写），
// 生产 synchronize 若被 DB_SYNC=0 关闭时靠此处幂等补列；IF NOT EXISTS 重复启动安全。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p9P5RiderComplianceSql = `
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertno" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertimg" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderhealthcertexpiry" timestamp;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderinsuranceno" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderinsuranceexpiry" timestamp;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderbackgroundcheck" varchar(255);
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsRiderbackgroundcheckat" timestamp
`;
let P9P5RiderComplianceMigration = class P9P5RiderComplianceMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p9P5RiderComplianceSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P9P5RiderComplianceMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P9P5RiderComplianceMigration = P9P5RiderComplianceMigration;
exports.P9P5RiderComplianceMigration = P9P5RiderComplianceMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P9P5RiderComplianceMigration);
//# sourceMappingURL=p9-p5-rider-compliance.js.map