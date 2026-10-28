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
exports.PickupPermissionsRoleGrantMigration = void 0;
// 幂等补齐自提点后台 CRUD 权限：
// 之前 pickup admin resolver 未声明 @Allow，任意已登录管理端用户都能读写自提点。
// 现改为需要 PickupLocationRead/Create/Update/Delete，为避免既有租户管理员/销售/收银
// 突然 403，这里给「已持有订单读写权限」的角色自动补授这四项权限。
// 幂等：仅追加缺失项，重复启动不会重复写入。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const GRANTED_PERMISSIONS = [
    'PickupLocationRead',
    'PickupLocationCreate',
    'PickupLocationUpdate',
    'PickupLocationDelete',
];
/** 触发补授的既有权限：具备订单读写能力的角色才需要维护自提点 */
const TRIGGER_PERMISSIONS = ['ReadOrder', 'UpdateOrder'];
let PickupPermissionsRoleGrantMigration = class PickupPermissionsRoleGrantMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        var _a;
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('role'))) {
                return;
            }
            const Q = (name) => this.connection.driver.escape(name);
            const driver = this.connection.options.type;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const p1 = isPostgres ? '$1' : '?';
            const p2 = isPostgres ? '$2' : '?';
            const rows = await queryRunner.query(`SELECT ${Q('id')} AS id, ${Q('permissions')} AS permissions FROM ${Q('role')}`);
            for (const row of rows) {
                const current = String((_a = row.permissions) !== null && _a !== void 0 ? _a : '')
                    .split(',')
                    .map(p => p.trim())
                    .filter(Boolean);
                if (!current.some(p => TRIGGER_PERMISSIONS.includes(p))) {
                    continue;
                }
                const missing = GRANTED_PERMISSIONS.filter(p => !current.includes(p));
                if (missing.length === 0) {
                    continue;
                }
                await queryRunner.query(`UPDATE ${Q('role')} SET ${Q('permissions')} = ${p1} WHERE ${Q('id')} = ${p2}`, [[...current, ...missing].join(','), row.id]);
                // eslint-disable-next-line no-console
                console.log(`[PickupPermissionsRoleGrantMigration] granted ${missing.join(',')} to role ${row.id}`);
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[PickupPermissionsRoleGrantMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.PickupPermissionsRoleGrantMigration = PickupPermissionsRoleGrantMigration;
exports.PickupPermissionsRoleGrantMigration = PickupPermissionsRoleGrantMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], PickupPermissionsRoleGrantMigration);
//# sourceMappingURL=migrate-pickup-permissions-role-grant.js.map