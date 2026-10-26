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
exports.P8P1PackingFeeMigration = exports.p8P1ProductPackingFeeSql = exports.p8P1PackingFeeSql = void 0;
// P1-1 批次（2026-10-26）：打包费/餐盒费。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/** 店铺级打包费配置（campus_fulfillment_config） */
exports.p8P1PackingFeeSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeMode" varchar(16) NOT NULL DEFAULT 'perItem';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeAmount" int NOT NULL DEFAULT 0;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeCap" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeLabel" varchar(32);
`;
/** 商品级覆盖：Product.waimaiPackingFee（分/件）→ 物理列 customFieldsWaimaipackingfee */
exports.p8P1ProductPackingFeeSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaipackingfee" int;
`;
let P8P1PackingFeeMigration = class P8P1PackingFeeMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [exports.p8P1PackingFeeSql, exports.p8P1ProductPackingFeeSql]) {
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
            console.error('[P8P1PackingFeeMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P8P1PackingFeeMigration = P8P1PackingFeeMigration;
exports.P8P1PackingFeeMigration = P8P1PackingFeeMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P8P1PackingFeeMigration);
//# sourceMappingURL=p8-p1-packing-fee.js.map