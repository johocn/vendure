"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryGatewayService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const delivery_order_entity_1 = require("./delivery-order.entity");
const constants_1 = require("./constants");
const TRANSITIONS = {
    pending: ['accepted', 'cancelled', 'exception'],
    accepted: ['pickup', 'cancelled', 'exception'],
    pickup: ['delivered', 'cancelled', 'exception'],
    delivered: [],
    cancelled: [],
    exception: ['cancelled'],
};
let DeliveryGatewayService = class DeliveryGatewayService {
    constructor() {
        this.providers = new Map();
    }
    init(injector) {
        this.injector = injector;
        this.connection = injector.get(core_1.TransactionalConnection);
    }
    registerProvider(provider) {
        this.providers.set(provider.code, provider);
        core_1.Logger.info(`同城配送 Provider 注册: ${provider.code}(${provider.name})`, constants_1.loggerCtx);
    }
    getProvider(code) {
        return this.providers.get(code);
    }
    async createDelivery(ctx, input) {
        const provider = this.getProvider(input.providerCode);
        if (!provider) {
            throw new Error(`未注册的配送商: ${input.providerCode}`);
        }
        const result = await provider.createDelivery(ctx, {
            orderId: input.orderId,
            packageId: input.packageId,
            pickup: input.pickup,
            dropoff: input.dropoff,
            items: input.items,
            deliveryType: 'instant',
            remark: input.remark,
        });
        const entity = this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder).create({
            // 必须用 Provider 返回的单号，applyStatusEvent 按 code 定位配送单
            code: result.deliveryOrderNo,
            orderId: input.orderId,
            packageId: input.packageId,
            fulfillmentId: null,
            providerCode: input.providerCode,
            thirdPartyNo: result.thirdPartyNo,
            status: result.status,
            pickupJson: JSON.stringify(input.pickup),
            dropoffJson: JSON.stringify(input.dropoff),
            itemsJson: JSON.stringify(input.items),
            fee: result.fee,
        });
        await this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder).save(entity);
        return entity;
    }
    /** 按订单查询配送单列表（新建在前） */
    async findByOrder(ctx, orderId) {
        return this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder).find({
            where: { orderId: orderId },
            order: { createdAt: 'ASC' },
        });
    }
    /** 处理平台回写（webhook 或 Mock 模拟），驱动状态机 */
    async applyStatusEvent(ctx, event) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder);
        const delivery = await repo.findOne({
            where: { code: event.deliveryOrderNo },
        });
        if (!delivery) {
            throw new Error(`配送单不存在: ${event.deliveryOrderNo}`);
        }
        const allowed = TRANSITIONS[delivery.status];
        if (!allowed.includes(event.status)) {
            core_1.Logger.warn(`非法配送状态流转 ${delivery.status}->${event.status}，忽略`, constants_1.loggerCtx);
            return delivery;
        }
        delivery.status = event.status;
        delivery.courierName = (_a = event.courierName) !== null && _a !== void 0 ? _a : delivery.courierName;
        delivery.courierPhone = (_b = event.courierPhone) !== null && _b !== void 0 ? _b : delivery.courierPhone;
        delivery.reason = (_c = event.reason) !== null && _c !== void 0 ? _c : delivery.reason;
        if (event.status === 'accepted')
            delivery.acceptedAt = new Date();
        if (event.status === 'pickup')
            delivery.pickupAt = new Date();
        if (event.status === 'delivered')
            delivery.deliveredAt = new Date();
        if (event.status === 'cancelled')
            delivery.cancelledAt = new Date();
        await repo.save(delivery);
        core_1.Logger.info(`配送单 ${delivery.code} -> ${event.status}`, constants_1.loggerCtx);
        return delivery;
    }
};
exports.DeliveryGatewayService = DeliveryGatewayService;
exports.DeliveryGatewayService = DeliveryGatewayService = __decorate([
    (0, common_1.Injectable)()
], DeliveryGatewayService);
//# sourceMappingURL=delivery-gateway.service.js.map