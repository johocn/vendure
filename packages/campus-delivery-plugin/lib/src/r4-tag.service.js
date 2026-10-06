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
exports.R4TagService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
/**
 * R4 打标写入方（二期 spec §5.4 缺口修复）：
 * waimai checkout「到店自取」直接 setOrderShippingMethod(store-pickup)，全链路无入口写
 * fulfillmentRoute='R4'（campusSetDeliveryTarget 拒绝 R4），订单详情核销码块
 * （isR4 && pickupCode）对真实用户永不渲染。
 * 统一在支付闸门（→ ArrangingPayment）打标：幂等、仅 campus 渠道、不覆盖已有路线。
 */
let R4TagService = class R4TagService {
    constructor(connection, hydrator, orderService) {
        this.connection = connection;
        this.hydrator = hydrator;
        this.orderService = orderService;
    }
    async tagR4({ ctx, order, toState }) {
        var _a, _b;
        if (toState !== 'ArrangingPayment')
            return;
        if ((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.fulfillmentRoute)
            return; // 已有路线（R1/R2/R3/R5）不碰
        const cfg = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        });
        if (!cfg)
            return; // 仅 campus 渠道生效
        const hydrated = await this.hydrator.hydrate(ctx, order, {
            relations: ['shippingLines', 'shippingLines.shippingMethod'],
        });
        const isStorePickup = ((_b = hydrated.shippingLines) !== null && _b !== void 0 ? _b : []).some(l => { var _a, _b; return (_b = (_a = l.shippingMethod) === null || _a === void 0 ? void 0 : _a.code) === null || _b === void 0 ? void 0 : _b.startsWith('store-pickup'); });
        if (!isStorePickup)
            return;
        await this.orderService.updateCustomFields(ctx, order.id, { fulfillmentRoute: 'R4' });
        core_1.Logger.info(`order=${order.code} tagged fulfillmentRoute=R4`, 'CampusR4Tag');
    }
};
exports.R4TagService = R4TagService;
exports.R4TagService = R4TagService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.EntityHydrator,
        core_1.OrderService])
], R4TagService);
//# sourceMappingURL=r4-tag.service.js.map