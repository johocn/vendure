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
exports.P9P7DeliveryFeeTiersMigration = exports.p9P7DeliveryFeeTiersSql = void 0;
// P3-4 批次（2026-10-27）：配送费阶梯计价（按订单商品金额分档替换分区基价）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p9P7DeliveryFeeTiersSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "deliveryFeeTiers" jsonb;
`;
let P9P7DeliveryFeeTiersMigration = class P9P7DeliveryFeeTiersMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p9P7DeliveryFeeTiersSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P9P7DeliveryFeeTiersMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P9P7DeliveryFeeTiersMigration = P9P7DeliveryFeeTiersMigration;
exports.P9P7DeliveryFeeTiersMigration = P9P7DeliveryFeeTiersMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P9P7DeliveryFeeTiersMigration);
//# sourceMappingURL=p9-p7-delivery-fee-tiers.js.map