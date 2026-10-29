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
exports.P15SupportTicketAfterSalesMigration = exports.p15SupportTicketAfterSalesSql = void 0;
// P15（2026-10-29）：工单与售后打通——工单落关联订单主键与售后单主键。
// 历史工单两列为 null（不回填：orderCode 为自由文本，无法可靠反解订单）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p15SupportTicketAfterSalesSql = `
ALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS "orderId" int;
ALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS "afterSalesRequestId" int;
CREATE INDEX IF NOT EXISTS idx_campus_support_ticket_aftersales ON campus_support_ticket ("afterSalesRequestId");
`;
let P15SupportTicketAfterSalesMigration = class P15SupportTicketAfterSalesMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p15SupportTicketAfterSalesSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P15SupportTicketAfterSalesMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P15SupportTicketAfterSalesMigration = P15SupportTicketAfterSalesMigration;
exports.P15SupportTicketAfterSalesMigration = P15SupportTicketAfterSalesMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P15SupportTicketAfterSalesMigration);
//# sourceMappingURL=p15-support-ticket-after-sales.js.map