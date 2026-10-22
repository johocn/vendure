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
    // 允许向前跳档：达达等真实平台回调可能跳过中间态（如 accepted 直接 delivered）；
    // 终态（delivered/cancelled）锁定不可再流转；非终态可随时取消/异常。
    pending: ['accepted', 'pickup', 'delivered', 'cancelled', 'exception'],
    accepted: ['pickup', 'delivered', 'cancelled', 'exception'],
    pickup: ['delivered', 'cancelled', 'exception'],
    delivered: [],
    cancelled: [],
    exception: ['cancelled'],
};
let DeliveryGatewayService = class DeliveryGatewayService {
    constructor() {
        this.providers = new Map();
        /** 可选：logistics-plugin 注册的 OrderPackageLinker（OrderPackageService），用于按包回填配送单 + 状态回写 */
        this.orderPackageLinker = null;
        /** 可选：业务侧（campus-delivery-plugin）注册的状态接收器，避免反向编译依赖 */
        this.statusSink = null;
    }
    init(injector) {
        this.injector = injector;
        this.connection = injector.get(core_1.TransactionalConnection);
        try {
            // 字符串 token + duck-typing：不引入对 @vendure/logistics-plugin 的编译依赖
            this.orderPackageLinker = injector.get('OrderPackageLinker');
        }
        catch (_a) {
            this.orderPackageLinker = null;
        }
        try {
            // 业务侧可能先于 init 注册（插件 bootstrap 顺序不定），两者都尝试
            const sink = injector.get('DeliveryStatusSink');
            if (sink && typeof sink.onDeliveryStatus === 'function') {
                this.statusSink = sink;
            }
        }
        catch (_b) {
            /* 未注册，保持 null */
        }
    }
    registerStatusSink(sink) {
        this.statusSink = sink;
    }
    registerProvider(provider) {
        this.providers.set(provider.code, provider);
        core_1.Logger.info(`同城配送 Provider 注册: ${provider.code}(${provider.name})`, constants_1.loggerCtx);
    }
    getProvider(code) {
        return this.providers.get(code);
    }
    async createDelivery(ctx, input) {
        var _a, _b, _c;
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
            providerShopNo: input.providerShopNo,
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
            etaMinutes: (_a = result.etaMinutes) !== null && _a !== void 0 ? _a : undefined,
        });
        await this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder).save(entity);
        // 挂钩点3：按 orderId + packageId 回填 OrderPackage.deliveryOrderId（未命中仅告警，不阻断）
        if (this.orderPackageLinker) {
            try {
                await this.orderPackageLinker.linkDeliveryOrder(ctx, input.orderId, input.packageId, entity.id);
            }
            catch (e) {
                core_1.Logger.warn(`OrderPackage 关联配送单失败 order#${input.orderId} pkg=${input.packageId}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            }
        }
        // 挂钩点3b：同城下单即视为发货 → OrderPackage pending→shipped（未命中仅告警，不阻断）
        if (this.orderPackageLinker) {
            try {
                await this.orderPackageLinker.transition(ctx, input.orderId, input.packageId, 'shipped');
            }
            catch (e) {
                core_1.Logger.warn(`OrderPackage 状态置 shipped 失败 order#${input.orderId} pkg=${input.packageId}: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, constants_1.loggerCtx);
            }
        }
        return entity;
    }
    /** 按订单查询配送单列表（新建在前） */
    async findByOrder(ctx, orderId) {
        return this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder).find({
            where: { orderId: orderId },
            order: { createdAt: 'ASC' },
        });
    }
    /** 取订单最新配送单（派单/展示用） */
    async findLatestByOrder(ctx, orderId) {
        const rows = await this.findByOrder(ctx, orderId);
        return rows.length ? rows[rows.length - 1] : null;
    }
    /** 取消外部快递配送（非终态才真正调用；终态直接返回幂等成功） */
    async cancelDelivery(ctx, deliveryOrderId, reason) {
        var _a;
        const repo = this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder);
        const delivery = await repo.findOne({ where: { id: deliveryOrderId } });
        if (!delivery) {
            throw new Error(`配送单不存在: ${deliveryOrderId}`);
        }
        if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
            return { success: true, reason: 'already-final' };
        }
        const provider = this.getProvider(delivery.providerCode);
        if (!provider) {
            throw new Error(`未注册的配送商: ${delivery.providerCode}`);
        }
        const result = await provider.cancelDelivery(ctx, (_a = delivery.thirdPartyNo) !== null && _a !== void 0 ? _a : delivery.code, reason);
        if (result.success) {
            delivery.status = 'cancelled';
            delivery.cancelledAt = new Date();
            delivery.reason = reason !== null && reason !== void 0 ? reason : delivery.reason;
            await repo.save(delivery);
        }
        return result;
    }
    /** 处理平台回写（webhook 或 Mock 模拟），驱动状态机 */
    async applyStatusEvent(ctx, event) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const repo = this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder);
        let delivery = await repo.findOne({
            where: { code: event.deliveryOrderNo },
        });
        // 兜底：达达回调可能仅含 client_id（达达单号=thirdPartyNo），按 thirdPartyNo 二次定位
        if (!delivery && event.deliveryOrderNo) {
            delivery = await repo.findOne({
                where: { thirdPartyNo: event.deliveryOrderNo },
            });
        }
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
        if (this.statusSink) {
            try {
                await this.statusSink.onDeliveryStatus(ctx, {
                    deliveryOrderId: delivery.id,
                    orderId: delivery.orderId,
                    packageId: delivery.packageId,
                    providerCode: delivery.providerCode,
                    thirdPartyNo: (_d = delivery.thirdPartyNo) !== null && _d !== void 0 ? _d : event.deliveryOrderNo,
                    status: event.status,
                    courierName: (_e = delivery.courierName) !== null && _e !== void 0 ? _e : undefined,
                    courierPhone: (_f = delivery.courierPhone) !== null && _f !== void 0 ? _f : undefined,
                    reason: event.reason,
                });
            }
            catch (e) {
                // 业务侧异常绝不影响平台回调 200
                core_1.Logger.warn(`DeliveryStatusSink 处理失败 ${delivery.code}: ${(_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : e}`, constants_1.loggerCtx);
            }
        }
        // 挂钩点3c：配送终态（delivered/cancelled）回写 OrderPackage（未命中仅告警，不阻断）
        if ((event.status === 'delivered' || event.status === 'cancelled') && this.orderPackageLinker && delivery.packageId) {
            try {
                await this.orderPackageLinker.transition(ctx, delivery.orderId, delivery.packageId, event.status);
            }
            catch (e) {
                core_1.Logger.warn(`OrderPackage 状态回写失败 ${delivery.code}: ${(_h = e === null || e === void 0 ? void 0 : e.message) !== null && _h !== void 0 ? _h : e}`, constants_1.loggerCtx);
            }
        }
        core_1.Logger.info(`配送单 ${delivery.code} -> ${event.status}`, constants_1.loggerCtx);
        return delivery;
    }
    /** 供 C端 Shop API 查询：返回配送单骑手信息（仅公开字段） */
    async getShopDelivery(ctx, deliveryOrderId) {
        var _a, _b, _c, _d;
        const repo = this.connection.getRepository(ctx, delivery_order_entity_1.DeliveryOrder);
        const delivery = await repo.findOne({ where: { id: deliveryOrderId } });
        if (!delivery) {
            return null;
        }
        return {
            courierName: (_a = delivery.courierName) !== null && _a !== void 0 ? _a : null,
            courierPhone: (_b = delivery.courierPhone) !== null && _b !== void 0 ? _b : null,
            thirdPartyNo: (_c = delivery.thirdPartyNo) !== null && _c !== void 0 ? _c : null,
            etaMinutes: (_d = delivery.etaMinutes) !== null && _d !== void 0 ? _d : null,
        };
    }
};
exports.DeliveryGatewayService = DeliveryGatewayService;
exports.DeliveryGatewayService = DeliveryGatewayService = __decorate([
    (0, common_1.Injectable)()
], DeliveryGatewayService);
//# sourceMappingURL=delivery-gateway.service.js.map