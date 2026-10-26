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
exports.P8P1AddonComboMigration = exports.p8P1_2OrderLineSql = exports.p8P1_2ProductSql = void 0;
// P1-2 批次（2026-10-26）：套餐/组合商品 + 加料（小料）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
// 物理列名规则：customFields + 字段名首字母大写、其余小写 → waimaiAddonGroups ⇒ customFieldsWaimaiaddongroups。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/** 商品级：加料组 JSON + 套餐内容 JSON */
exports.p8P1_2ProductSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaddongroups" text;
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaicombo" text;
`;
/** 订单行级：加料选择快照 JSON */
exports.p8P1_2OrderLineSql = `
ALTER TABLE order_line ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaddons" text;
`;
let P8P1AddonComboMigration = class P8P1AddonComboMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [exports.p8P1_2ProductSql, exports.p8P1_2OrderLineSql]) {
                    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
                        await qr.query(statement);
                    }
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P8P1AddonComboMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P8P1AddonComboMigration = P8P1AddonComboMigration;
exports.P8P1AddonComboMigration = P8P1AddonComboMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P8P1AddonComboMigration);
//# sourceMappingURL=p8-p1-2-addon-combo.js.map