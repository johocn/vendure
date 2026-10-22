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
exports.ThirdPartyDeliveryService = void 0;
exports.nextHallStateAfterHandover = nextHallStateAfterHandover;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_notify_service_1 = require("./campus-notify.service");
const hall_service_1 = require("./hall.service");
const route_matrix_1 = require("./route-matrix");
const loggerCtx = 'ThirdPartyDelivery';
/** 第一段完成后的本地状态（纯函数，便于单测）：只有「直送」才算完成，其余都进大厅接力 */
function nextHallStateAfterHandover(handover) {
    if (handover === 'direct_to_user')
        return { hallStatus: 'delivered', deliveryStatus: 'delivered' };
    return { hallStatus: 'open', deliveryStatus: null };
}
let ThirdPartyDeliveryService = class ThirdPartyDeliveryService {
    constructor(connection, hall, notify, moduleRef) {
        this.connection = connection;
        this.hall = hall;
        this.notify = notify;
        this.moduleRef = moduleRef;
    }
    onApplicationBootstrap() {
        var _a;
        try {
            this.gateway.registerStatusSink(this);
            core_2.Logger.info('外部快递状态回调已接入订单履约', loggerCtx);
        }
        catch (e) {
            core_2.Logger.warn(`外部快递状态回调接入失败: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
        }
    }
    /** 懒解析网关（字符串 token，避免 campus → gateway 编译依赖） */
    get gateway() {
        return new core_2.Injector(this.moduleRef).get('DeliveryGatewayService');
    }
    get cfgRepo() {
        return this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
    }
    orderRepo(ctx) {
        return this.connection.getRepository(ctx, core_2.Order);
    }
    async ctxForChannel(channelId) {
        var _a;
        const channel = (_a = (await this.connection.rawConnection.getRepository(core_2.Channel).findOne({
            where: { id: channelId },
            relations: ['defaultTaxZone'],
        }))) !== null && _a !== void 0 ? _a : new core_2.Channel({ id: channelId });
        return new core_2.RequestContext({ apiType: 'admin', channel, isAuthorized: true, authorizedAsOwnerOnly: false });
    }
    /**
     * 推送外部快递（运营中心在派单时选择提供方）。
     * - R2：外部快递从商户取货 → 校园交接点（R2 交接点）
     * - R3：当前策略为 external 时，外部快递整段直送学生
     */
    async dispatchExternal(ctx, orderId, provider) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        if (provider !== 'dada' && provider !== 'meituan')
            throw new core_2.UserInputError('外部快递仅支持 dada/meituan');
        const order = await this.orderRepo(ctx).findOne({
            where: { id: orderId },
            relations: ['channels', 'lines', 'lines.productVariant', 'customer', 'shippingAddress'],
        });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        const cf = order.customFields;
        if (cf.hallStatus === 'cancelled')
            throw new core_2.UserInputError('订单已取消');
        if (cf.thirdPartyNo && cf.thirdPartyState !== 'cancelled') {
            return { ok: true, already: true, thirdPartyNo: cf.thirdPartyNo };
        }
        const channelId = (_c = (_b = (_a = order.channels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : ctx.channelId;
        const cfg = await this.cfgRepo.findOne({ where: { channelId: channelId } });
        if (!cfg)
            throw new core_2.UserInputError('店铺未配置履约信息');
        const route = String((_d = cf.fulfillmentRoute) !== null && _d !== void 0 ? _d : '');
        const plan = (0, route_matrix_1.resolveRoutePlan)(route, cfg, provider);
        if (!plan)
            throw new core_2.UserInputError(`路线 ${route} 不支持外部快递`);
        // 在途单以「下单快照」为准，避免中途改配置换运力
        const leg1 = String(cf.deliveryPlan || plan.leg1);
        if (plan.dispatch !== 'external_push' && leg1 !== 'external_courier') {
            throw new core_2.UserInputError(`路线 ${route} 当前未启用外部快递`);
        }
        const oCtx = await this.ctxForChannel(channelId);
        const pickup = (0, route_matrix_1.resolvePickup)(plan.route, cfg);
        if (!pickup)
            throw new core_2.UserInputError('店铺取货点经纬度缺失，无法推送外部快递');
        const building = cf.buildingId
            ? await this.connection.rawConnection.getRepository(campus_building_entity_1.CampusBuilding).findOne({
                where: { id: Number(cf.buildingId) },
            })
            : null;
        const userPoint = {
            name: (_f = (_e = order.shippingAddress) === null || _e === void 0 ? void 0 : _e.fullName) !== null && _f !== void 0 ? _f : '用户',
            address: [building === null || building === void 0 ? void 0 : building.name, (_g = order.shippingAddress) === null || _g === void 0 ? void 0 : _g.streetLine1].filter(Boolean).join(' ') || undefined,
            lat: Number((_h = building === null || building === void 0 ? void 0 : building.lat) !== null && _h !== void 0 ? _h : 0),
            lng: Number((_j = building === null || building === void 0 ? void 0 : building.lng) !== null && _j !== void 0 ? _j : 0),
            phone: (_l = (_k = order.shippingAddress) === null || _k === void 0 ? void 0 : _k.phoneNumber) !== null && _l !== void 0 ? _l : undefined,
        };
        // 交接点按「本路线」取：下单快照优先，缺失才用店铺当前配置
        const snapPoint = cf.handoverPointLat != null && cf.handoverPointLng != null
            ? {
                name: String((_m = cf.handoverPointName) !== null && _m !== void 0 ? _m : ''),
                address: (_o = cf.handoverPointAddress) !== null && _o !== void 0 ? _o : undefined,
                lat: Number(cf.handoverPointLat),
                lng: Number(cf.handoverPointLng),
            }
            : undefined;
        const effCfg = Object.assign(Object.assign({}, cfg), { handoverPoints: Object.assign(Object.assign({}, ((_p = cfg.handoverPoints) !== null && _p !== void 0 ? _p : {})), (snapPoint ? { [plan.route]: [snapPoint] } : {})) });
        // 无快照时按楼栋坐标挑最近交接点；楼栋缺坐标则由默认点兜底
        const dest = (building === null || building === void 0 ? void 0 : building.lat) != null && (building === null || building === void 0 ? void 0 : building.lng) != null
            ? { lat: Number(building.lat), lng: Number(building.lng) }
            : null;
        const dropoff = (0, route_matrix_1.resolveDropoff)(plan.route, plan, effCfg, userPoint, dest);
        if (!dropoff)
            throw new core_2.UserInputError(`路线 ${plan.route} 未配置校园交接点，无法推送外部快递`);
        if (!dropoff.lat || !dropoff.lng)
            throw new core_2.UserInputError('收货点经纬度缺失，无法推送外部快递');
        const delivery = await this.gateway.createDelivery(oCtx, {
            orderId: order.id,
            packageId: String(order.id),
            providerCode: provider,
            providerShopNo: (_r = (_q = cfg.providerShopNo) === null || _q === void 0 ? void 0 : _q[provider]) !== null && _r !== void 0 ? _r : undefined,
            pickup,
            dropoff,
            items: ((_s = order.lines) !== null && _s !== void 0 ? _s : []).map(l => { var _a, _b; return ({ name: (_b = (_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '餐品', quantity: l.quantity }); }),
            remark: (_t = cf.note) !== null && _t !== void 0 ? _t : undefined,
        });
        await this.hall.updateOrder(oCtx, orderId, {
            customFields: {
                deliveryPlan: 'external_courier',
                handoverMode: (_u = plan.handover) !== null && _u !== void 0 ? _u : '',
                thirdPartyProvider: provider,
                thirdPartyDeliveryOrderId: String(delivery.id),
                thirdPartyNo: (_v = delivery.thirdPartyNo) !== null && _v !== void 0 ? _v : delivery.code,
                thirdPartyState: delivery.status,
                thirdPartyFee: (_w = delivery.fee) !== null && _w !== void 0 ? _w : null,
                thirdPartyDispatchAt: new Date(),
                handoverPointName: (_x = dropoff.name) !== null && _x !== void 0 ? _x : '',
                handoverPointAddress: (_y = dropoff.address) !== null && _y !== void 0 ? _y : null,
                handoverPointLat: dropoff.lat,
                handoverPointLng: dropoff.lng,
                hallStatus: 'third_party',
                campusCause: 'external_dispatched',
            },
        });
        core_2.Logger.info(`订单 ${order.code} 已推送 ${provider}:${(_z = delivery.thirdPartyNo) !== null && _z !== void 0 ? _z : delivery.code}`, loggerCtx);
        return { ok: true, thirdPartyNo: (_0 = delivery.thirdPartyNo) !== null && _0 !== void 0 ? _0 : delivery.code, provider };
    }
    /** 取消外部快递配送（商家关单 / 推送失败回落前调用），幂等 */
    async cancel(ctx, orderId, reason) {
        var _a, _b, _c;
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId }, relations: ['channels'] });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        const cf = order.customFields;
        if (!cf.thirdPartyDeliveryOrderId)
            return { ok: true, skipped: true };
        const oCtx = await this.ctxForChannel((_c = (_b = (_a = order.channels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : ctx.channelId);
        const res = await this.gateway.cancelDelivery(oCtx, Number(cf.thirdPartyDeliveryOrderId), reason);
        if (res.success) {
            await this.hall.updateOrder(oCtx, orderId, {
                customFields: { thirdPartyState: 'cancelled', campusCause: 'third_party_cancelled' },
            });
        }
        return { ok: res.success, reason: res.reason };
    }
    /** 网关回调（由 DeliveryStatusSink 调用） */
    async onDeliveryStatus(ctx, update) {
        var _a, _b, _c, _d, _e;
        const order = await this.orderRepo(ctx).findOne({
            where: { id: update.orderId },
            relations: ['channels', 'customer'],
        });
        if (!order) {
            core_2.Logger.warn(`回调订单不存在 #${update.orderId}`, loggerCtx);
            return;
        }
        const channelId = (_c = (_b = (_a = order.channels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : ctx.channelId;
        const oCtx = await this.ctxForChannel(channelId);
        const cf = order.customFields;
        const patch = {
            thirdPartyState: update.status,
            thirdPartyNo: update.thirdPartyNo || cf.thirdPartyNo,
        };
        if (update.courierName)
            patch.thirdPartyCourierName = update.courierName;
        if (update.courierPhone)
            patch.thirdPartyCourierPhone = update.courierPhone;
        if (update.status === 'delivered') {
            const next = nextHallStateAfterHandover(String((_d = cf.handoverMode) !== null && _d !== void 0 ? _d : ''));
            patch.handoverAt = new Date();
            if (next.hallStatus === 'open') {
                // R1/R2：送达交接点 → 进大厅接力（统一写 open/hallEnteredAt/campusCause 并提醒骑手）
                await this.hall.updateOrder(oCtx, Number(order.id), {
                    customFields: Object.assign(Object.assign({}, patch), { thirdPartyState: update.status, thirdPartyNo: patch.thirdPartyNo }),
                });
                await this.hall.enterHallForHandover(oCtx, Number(order.id), 'external_handover');
                return;
            }
            // R3 外部快递整段直送：直接完成
            patch.hallStatus = 'delivered';
            patch.deliveryStatus = 'delivered';
            patch.deliveredAt = new Date();
        }
        else if (update.status === 'cancelled' || update.status === 'exception') {
            const route = String((_e = cf.fulfillmentRoute) !== null && _e !== void 0 ? _e : '');
            if (route === 'R2') {
                // R2 回到待推送，由运营中心换一家外部快递
                patch.hallStatus = 'pending_dispatch';
                patch.campusCause = update.status === 'exception' ? 'external_exception' : 'external_cancelled';
            }
            else {
                // R3 运力失败 → 回抢单大厅，由传信者兜底
                patch.hallStatus = 'open';
                patch.deliveryPlan = 'campus_rider';
                patch.handoverMode = '';
                patch.thirdPartyProvider = '';
                patch.campusCause = 'external_failed_to_hall';
            }
        }
        await this.hall.updateOrder(oCtx, Number(order.id), { customFields: patch });
        if (update.status === 'delivered' && cf.handoverMode === 'direct_to_user') {
            this.notify.user(oCtx, order.id, 'orderDelivered');
        }
    }
    /** 自营快递接单（R1 商户超时转自营 / R3 自营快递池） */
    async acceptOwned(ctx, orderId) {
        var _a;
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId } });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        const cf = order.customFields;
        if (!['pending_merchant', 'open', 'owned_pool'].includes(String((_a = cf.hallStatus) !== null && _a !== void 0 ? _a : ''))) {
            throw new core_2.UserInputError('订单当前状态不可由自营快递接单');
        }
        await this.hall.updateOrder(ctx, orderId, {
            customFields: {
                deliveryPlan: 'owned',
                hallStatus: 'owned_dispatched',
                assignedAt: new Date(),
                campusCause: 'owned_accepted',
            },
        });
        return { ok: true };
    }
    /** 第一段（商户 / 自营快递）送达校园交接点：R1/R2 进大厅接力，R3 直接完成 */
    async completeFirstLeg(ctx, orderId, cause) {
        var _a, _b;
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId } });
        if (!order)
            throw new core_2.UserInputError('订单不存在');
        const cf = order.customFields;
        const route = String((_a = cf.fulfillmentRoute) !== null && _a !== void 0 ? _a : '');
        if (!['merchant', 'owned'].includes(String((_b = cf.deliveryPlan) !== null && _b !== void 0 ? _b : ''))) {
            throw new core_2.UserInputError('当前订单第一段不是商户/自营快递');
        }
        if (route === 'R3') {
            await this.hall.updateOrder(ctx, orderId, {
                customFields: {
                    hallStatus: 'delivered',
                    deliveryStatus: 'delivered',
                    deliveredAt: new Date(),
                    handoverAt: new Date(),
                    campusCause: cause,
                },
            });
            this.notify.user(ctx, order.id, 'orderDelivered');
            return { ok: true, done: true };
        }
        await this.hall.updateOrder(ctx, orderId, {
            customFields: { handoverAt: new Date(), thirdPartyState: '' },
        });
        await this.hall.enterHallForHandover(ctx, orderId, cause);
        return { ok: true, done: false };
    }
};
exports.ThirdPartyDeliveryService = ThirdPartyDeliveryService;
exports.ThirdPartyDeliveryService = ThirdPartyDeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        hall_service_1.HallService,
        campus_notify_service_1.CampusNotifyService,
        core_1.ModuleRef])
], ThirdPartyDeliveryService);
//# sourceMappingURL=third-party-delivery.service.js.map