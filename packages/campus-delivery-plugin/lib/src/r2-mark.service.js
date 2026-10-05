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
exports.R2MarkService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/**
 * R2 快递单：学生确认快递已到校（第一程完成）。
 * 「发跑腿代取」走 Task 9 两步式 errand 链路（addItemToOrder + campusSetErrandInfo），天然复用。
 * 归属校验：customer.user.id 与 ctx.activeUserId 同为 User 表主键，直接可比。
 */
let R2MarkService = class R2MarkService {
    constructor(connection, orderService) {
        this.connection = connection;
        this.orderService = orderService;
    }
    /** R2: 学生确认快递已到校 → leg1Status='arrived_gate' + handoverAt */
    async markArrived(ctx, orderId) {
        var _a, _b, _c;
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        if (((_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== ctx.activeUserId)
            throw new core_1.ForbiddenError();
        if (((_c = order.customFields) === null || _c === void 0 ? void 0 : _c.fulfillmentRoute) !== 'R2') {
            throw new core_1.UserInputError('仅 R2 快递单支持到校确认');
        }
        await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
            customFields: { leg1Status: 'arrived_gate', handoverAt: new Date() },
        });
        return { leg1Status: 'arrived_gate' };
    }
};
exports.R2MarkService = R2MarkService;
exports.R2MarkService = R2MarkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.OrderService])
], R2MarkService);
//# sourceMappingURL=r2-mark.service.js.map