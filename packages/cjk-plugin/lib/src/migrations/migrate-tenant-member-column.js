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
exports.TenantMemberColumnMigration = void 0;
// 确保 tenant_member 表存在 mustChangePassword 列（首登强改密）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let TenantMemberColumnMigration = class TenantMemberColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('TenantMember');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasColumn(tableName, 'must_change_password'))) {
                    // 布尔列默认 false：既有人员无需强改密，仅新建未传密码人员置 true
                    await queryRunner.addColumn(tableName, new typeorm_2.TableColumn({
                        name: 'must_change_password',
                        type: 'boolean',
                        isNullable: false,
                        default: false,
                    }));
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试；不影响已存在列的场景
            // eslint-disable-next-line no-console
            console.error('[TenantMemberColumnMigration] failed to ensure mustChangePassword column:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.TenantMemberColumnMigration = TenantMemberColumnMigration;
exports.TenantMemberColumnMigration = TenantMemberColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], TenantMemberColumnMigration);
//# sourceMappingURL=migrate-tenant-member-column.js.map