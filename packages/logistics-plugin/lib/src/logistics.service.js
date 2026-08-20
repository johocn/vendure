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
exports.LogisticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const logistics_track_entity_1 = require("./logistics-track.entity");
const carrier_dictionary_1 = require("./carrier-dictionary");
const tracking_provider_1 = require("./tracking-provider");
const order_package_service_1 = require("./order-package.service");
const MANUAL_FULFILLMENT_HANDLER_CODE = 'manual-fulfillment';
let LogisticsService = class LogisticsService {
    constructor(connection) {
        this.connection = connection;
        this.orderService = null;
        this.trackingProvider = new tracking_provider_1.NoopTrackingProvider();
        this.orderPackageService = null;
    }
    init(injector) {
        var _a;
        this.orderService = injector.get(core_1.OrderService);
        try {
            const options = injector.get(constants_1.LOGISTICS_PLUGIN_OPTIONS);
            this.trackingProvider = (_a = options === null || options === void 0 ? void 0 : options.trackingProvider) !== null && _a !== void 0 ? _a : new tracking_provider_1.NoopTrackingProvider();
        }
        catch (_b) {
            this.trackingProvider = new tracking_provider_1.NoopTrackingProvider();
        }
        try {
            this.orderPackageService = injector.get(order_package_service_1.OrderPackageService);
        }
        catch (_c) {
            this.orderPackageService = null;
        }
    }
    /**
     * 创建物流轨迹记录（绑定 fulfillment 与渠道）。
     */
    async createTrack(ctx, fulfillmentId, trackingNo, carrierCode) {
        if (!(0, carrier_dictionary_1.getCarrierByCode)(carrierCode)) {
            throw new core_1.UserInputError(`Unknown carrierCode: ${carrierCode}`);
        }
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        const track = new logistics_track_entity_1.LogisticsTrack({
            fulfillmentId: fulfillmentId,
            trackingNo,
            carrierCode,
            status: 'unknown',
        });
        track.channelId = ctx.channelId;
        track.channels = [ctx.channel];
        const saved = await repo.save(track);
        core_1.Logger.info(`LogisticsTrack ${saved.id} created for fulfillment ${fulfillmentId}`, constants_1.loggerCtx);
        return saved;
    }
    /**
     * 调用 Provider 查询物流轨迹，更新 entity。
     */
    async queryTrack(ctx, trackId) {
        var _a;
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        const track = await repo.findOne({ where: { id: trackId } });
        if (!track) {
            throw new core_1.EntityNotFoundError('LogisticsTrack', trackId);
        }
        try {
            const result = await this.trackingProvider.queryTrack(ctx, track.carrierCode, track.trackingNo);
            track.status = result.status;
            track.trackInfo = JSON.stringify(result.tracks);
            track.signedAt = (_a = result.signedAt) !== null && _a !== void 0 ? _a : undefined;
            track.lastSyncedAt = new Date();
            track.lastError = null;
            await repo.save(track);
        }
        catch (e) {
            track.lastError = e.message;
            track.lastSyncedAt = new Date();
            await repo.save(track);
            core_1.Logger.error(`Query track failed for ${trackId}: ${e.message}`, constants_1.loggerCtx);
        }
        return track;
    }
    /**
     * 批量发货：为每个 order 创建 Fulfillment + LogisticsTrack。
     * Fulfillment customFields（trackingNumber/carrier/carrierCode）同步回写。
     */
    async batchCreateFulfillment(ctx, items) {
        var _a, _b, _c, _d;
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const results = [];
        for (const item of items) {
            try {
                const carrierDef = (0, carrier_dictionary_1.getCarrierByCode)(item.carrierCode);
                if (!carrierDef) {
                    throw new core_1.UserInputError(`Unknown carrierCode: ${item.carrierCode}`);
                }
                const order = await this.orderService.findOne(ctx, item.orderId, ['lines']);
                if (!order) {
                    throw new core_1.UserInputError(`Order ${item.orderId} not found`);
                }
                const lines = order.lines.map(l => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length === 0) {
                    throw new core_1.UserInputError(`Order ${item.orderId} has no lines`);
                }
                // 1. 调用 orderService.createFulfillment 创建发货记录
                const fulfillmentResult = await this.orderService.createFulfillment(ctx, {
                    lines,
                    handler: {
                        code: MANUAL_FULFILLMENT_HANDLER_CODE,
                        arguments: [
                            { name: 'method', value: carrierDef.name },
                            { name: 'trackingCode', value: item.trackingNo },
                        ],
                    },
                });
                if (isFulfillmentError(fulfillmentResult)) {
                    throw new Error(`Fulfillment error: ${(_a = fulfillmentResult.message) !== null && _a !== void 0 ? _a : 'unknown'}`);
                }
                const fulfillment = fulfillmentResult;
                // 2. 回写 Fulfillment customFields（carrierCode/carrier/trackingNumber + 拆单包号/本包运费）
                await this.updateFulfillmentCustomFields(ctx, fulfillment.id, Object.assign(Object.assign({ trackingNumber: item.trackingNo, carrier: carrierDef.name, carrierCode: item.carrierCode }, (item.packageId != null ? { packageId: item.packageId } : {})), (item.shippingFee != null ? { shippingFee: item.shippingFee } : {})));
                // 挂钩点2：按包回填 OrderPackage.fulfillmentId + 实际运费（未命中仅告警，不阻断发货）
                if (item.packageId) {
                    try {
                        await ((_b = this.orderPackageService) === null || _b === void 0 ? void 0 : _b.linkFulfillment(ctx, item.orderId, item.packageId, fulfillment.id, (_c = item.shippingFee) !== null && _c !== void 0 ? _c : null));
                    }
                    catch (e) {
                        core_1.Logger.warn(`OrderPackage 回填发货失败 order#${item.orderId} pkg=${item.packageId}: ${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, constants_1.loggerCtx);
                    }
                }
                // 3. 创建 LogisticsTrack 记录
                const track = await this.createTrack(ctx, fulfillment.id, item.trackingNo, item.carrierCode);
                results.push({ orderId: item.orderId, success: true, trackId: track.id });
            }
            catch (e) {
                results.push({
                    orderId: item.orderId,
                    success: false,
                    trackId: null,
                    error: e.message,
                });
            }
        }
        return results;
    }
    /**
     * 查询订单的物流轨迹（按 fulfillment 关联）。
     */
    async getTracksByOrder(ctx, orderId) {
        var _a;
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', orderId);
        }
        const fulfillmentIds = ((_a = order.fulfillments) !== null && _a !== void 0 ? _a : []).map(f => f.id);
        if (fulfillmentIds.length === 0) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        return repo.find({
            where: { fulfillmentId: (0, typeorm_1.In)(fulfillmentIds) },
            order: { updatedAt: 'DESC' },
        });
    }
    /**
     * Shop 端查询订单物流轨迹：需校验订单归属（customerId 匹配）。
     */
    async getMyOrderTracks(ctx, orderId) {
        var _a;
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'fulfillments']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', orderId);
        }
        if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
            throw new core_1.ForbiddenError();
        }
        const fulfillmentIds = ((_a = order.fulfillments) !== null && _a !== void 0 ? _a : []).map(f => f.id);
        if (fulfillmentIds.length === 0) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        return repo.find({
            where: { fulfillmentId: (0, typeorm_1.In)(fulfillmentIds) },
            order: { updatedAt: 'DESC' },
        });
    }
    /**
     * 接收第三方 webhook 回调，按 carrierCode + trackingNo 定位 track 并更新。
     */
    async receiveCallback(ctx, carrierCode, trackingNo, trackResult) {
        var _a;
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        const track = await repo.findOne({
            where: { carrierCode, trackingNo },
        });
        if (!track) {
            core_1.Logger.warn(`Callback received for unknown track: ${carrierCode}/${trackingNo}`, constants_1.loggerCtx);
            return null;
        }
        track.status = trackResult.status;
        track.trackInfo = JSON.stringify(trackResult.tracks);
        track.signedAt = (_a = trackResult.signedAt) !== null && _a !== void 0 ? _a : undefined;
        track.lastSyncedAt = new Date();
        track.lastError = null;
        return repo.save(track);
    }
    async findOne(ctx, id) {
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        const result = await repo.findOne({ where: { id: id } });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findAll(ctx, options) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
        const [items, totalItems] = await repo.findAndCount({
            where: { channelId: ctx.channelId },
            order: { updatedAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    /**
     * 回写 Fulfillment customFields。失败仅告警，不影响主流程。
     */
    async updateFulfillmentCustomFields(ctx, fulfillmentId, values) {
        var _a;
        try {
            const repo = this.connection.getRepository(ctx, core_1.Fulfillment);
            const fulfillment = await repo.findOne({ where: { id: fulfillmentId } });
            if (!fulfillment)
                return;
            fulfillment.customFields = Object.assign(Object.assign({}, ((_a = fulfillment.customFields) !== null && _a !== void 0 ? _a : {})), values);
            await repo.save(fulfillment);
        }
        catch (e) {
            core_1.Logger.warn(`Failed to update fulfillment customFields: ${e.message}`, constants_1.loggerCtx);
        }
    }
};
exports.LogisticsService = LogisticsService;
exports.LogisticsService = LogisticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], LogisticsService);
/**
 * 判断 createFulfillment 返回是否为错误结果。
 */
function isFulfillmentError(result) {
    if (!result)
        return true;
    if (typeof result !== 'object')
        return false;
    // ErrorResult 都带 errorCode
    return 'errorCode' in result;
}
//# sourceMappingURL=logistics.service.js.map