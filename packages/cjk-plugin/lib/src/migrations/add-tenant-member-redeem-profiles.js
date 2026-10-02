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
exports.AddTenantMemberRedeemProfiles = void 0;
// 确保 tenant_member 表存在 shipping_profile_ids 列（可核销配送档案白名单）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
// 幂等由 IF NOT EXISTS 保证；默认值 '[]' 须带单引号（TypeORM TableColumn 会产出未加引号的 DEFAULT []）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let AddTenantMemberRedeemProfiles = class AddTenantMemberRedeemProfiles {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(`ALTER TABLE "tenant_member" ADD COLUMN IF NOT EXISTS "shipping_profile_ids" text NOT NULL DEFAULT '[]';`);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddTenantMemberRedeemProfiles] failed to ensure column:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddTenantMemberRedeemProfiles = AddTenantMemberRedeemProfiles;
exports.AddTenantMemberRedeemProfiles = AddTenantMemberRedeemProfiles = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddTenantMemberRedeemProfiles);
//# sourceMappingURL=add-tenant-member-redeem-profiles.js.map