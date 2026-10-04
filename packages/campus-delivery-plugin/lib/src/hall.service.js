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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HallService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 */
let HallService = class HallService {
    constructor(connection) {
        this.connection = connection;
    }
    async onOrderPlaced(ctx, order) {
        const cf = order.customFields;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
                customFields: { hallStatus: 'open', hallEnteredAt: new Date() },
            });
            core_1.Logger.info(`Order ${order.code} entered hall (${cf.fulfillmentRoute})`, 'CampusHall');
        }
    }
};
exports.HallService = HallService;
exports.HallService = HallService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], HallService);
//# sourceMappingURL=hall.service.js.map