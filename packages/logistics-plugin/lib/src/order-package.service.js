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
exports.OrderPackageService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const order_package_entity_1 = require("./order-package.entity");
const logistics_track_entity_1 = require("./logistics-track.entity");
/** 合法流转表：终态（delivered/cancelled）不在任何源态中，天然不可回退 */
const TRANSITIONS = {
    pending: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
};
let OrderPackageService = class OrderPackageService {
    constructor(connection) {
        this.connection = connection;
        this.injector = null;
        this.orderService = null;
        this.deliveryShopLinker = null;
    }
    /** 由 LogisticsPlugin.onApplicationBootstrap 调用，注入器就绪后解析可选依赖 */
    init(injector) {
        this.injector = injector;
        try {
            this.orderService = this.injector.get(core_1.OrderService);
        }
        catch (e) {
            core_1.Logger.warn('OrderPackageService 无法获取 OrderService，getMyOrderPackages 将不可用', constants_1.loggerCtx);
            this.orderService = null;
        }
        try {
            // duck-typing：delivery-gateway-plugin 可选提供（零编译依赖）
            this.deliveryShopLinker = this.injector.get('DeliveryOrderShopLinker');
        }
        catch (e) {
            core_1.Logger.warn('DeliveryOrderShopLinker 未找到，city 包骑手信息将不可用', constants_1.loggerCtx);
            this.deliveryShopLinker = null;
        }
    }
    /** 拆单确认：先删后插（幂等，重复确认干净替换），返回落库后的包裹列表 */
    async replaceForOrder(ctx, orderId, packages) {
        const repo = this.connection.getRepository(ctx, order_package_entity_1.OrderPackage);
        await repo.delete({ orderId: orderId });
        const entities = packages.map(p => repo.create({
            code: p.packageId,
            orderId,
            stockLocationId: p.stockLocationId,
            linesJson: JSON.stringify(p.lines),
            shippingFee: p.estimatedShippingFee || 0,
            deliveryMode: p.deliveryMode,
            fulfillmentId: null,
            deliveryOrderId: null,
        }));
        await repo.save(entities);
        core_1.Logger.info(`order#${orderId} 落库 OrderPackage ${entities.length} 包`, constants_1.loggerCtx);
        return this.findByOrder(ctx, orderId);
    }
    /** 发货回填：按 orderId + code 匹配包裹，补 fulfillmentId 与实际运费，返回是否命中 */
    async linkFulfillment(ctx, orderId, packageId, fulfillmentId, actualShippingFee) {
        const repo = this.connection.getRepository(ctx, order_package_entity_1.OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId, code: packageId } });
        if (!pkg) {
            core_1.Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过发货回填`, constants_1.loggerCtx);
            return false;
        }
        pkg.fulfillmentId = fulfillmentId;
        if (actualShippingFee != null) {
            pkg.shippingFee = actualShippingFee;
        }
        await repo.save(pkg);
        return true;
    }
    /** 配送关联：按 orderId + code 匹配包裹，回填 deliveryOrderId，返回是否命中 */
    async linkDeliveryOrder(ctx, orderId, packageId, deliveryOrderId) {
        const repo = this.connection.getRepository(ctx, order_package_entity_1.OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId, code: packageId } });
        if (!pkg) {
            core_1.Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过配送关联`, constants_1.loggerCtx);
            return false;
        }
        pkg.deliveryOrderId = deliveryOrderId;
        await repo.save(pkg);
        return true;
    }
    /** 订单级包裹查询（按包号排序） */
    async findByOrder(ctx, orderId) {
        return this.connection.getRepository(ctx, order_package_entity_1.OrderPackage).find({
            where: { orderId: orderId },
            order: { code: 'ASC' },
        });
    }
    /** 状态流转：幂等（同状态返回 true）、非法流转告警忽略、未命中告警返回 false；不抛错不阻断主链路 */
    async transition(ctx, orderId, packageId, toStatus) {
        const repo = this.connection.getRepository(ctx, order_package_entity_1.OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId, code: packageId } });
        if (!pkg) {
            core_1.Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过状态流转 ${toStatus}`, constants_1.loggerCtx);
            return false;
        }
        if (pkg.status === toStatus) {
            return true; // 幂等
        }
        if (!TRANSITIONS[pkg.status].includes(toStatus)) {
            core_1.Logger.warn(`非法包裹状态流转 ${pkg.status}->${toStatus}（order#${orderId} pkg=${packageId}），忽略`, constants_1.loggerCtx);
            return false;
        }
        pkg.status = toStatus;
        if (toStatus === 'shipped')
            pkg.shippedAt = new Date();
        if (toStatus === 'delivered')
            pkg.deliveredAt = new Date();
        if (toStatus === 'cancelled')
            pkg.cancelledAt = new Date();
        await repo.save(pkg);
        core_1.Logger.info(`OrderPackage order#${orderId} pkg=${packageId} -> ${toStatus}`, constants_1.loggerCtx);
        return true;
    }
    /** C端查询：本人订单包裹列表（按包号排序），返回可直接渲染的富化结果 */
    async getMyOrderPackages(ctx, orderId) {
        var _a, _b, _c;
        // 1. 归属校验
        if (!this.orderService) {
            throw new Error('OrderService 未初始化');
        }
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', orderId);
        }
        // 注意：order.customer.id 是 Customer 主键，而 ctx.activeUserId 是关联 User 主键，两者不同。
        // 归属校验必须基于 customer.user.id 与 activeUserId 比较。
        const customerUserId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new core_1.ForbiddenError();
        }
        // 2. 取包裹列表（已按 code 排序）
        const packages = await this.findByOrder(ctx, orderId);
        // 3. 解析 linesJson，收集 lineIds 用于富化
        const allLineIds = [];
        const linesByPackage = [];
        for (const pkg of packages) {
            let lines = [];
            if (pkg.linesJson) {
                try {
                    lines = JSON.parse(pkg.linesJson);
                }
                catch (e) {
                    core_1.Logger.warn(`order#${orderId} pkg=${pkg.code} linesJson 解析失败`, constants_1.loggerCtx);
                }
            }
            linesByPackage.push(lines);
            allLineIds.push(...lines.map(l => l.orderLineId));
        }
        // 4. 富化：join OrderLine → variant → product → translations 取 productName/sku
        const lineMap = new Map();
        if (allLineIds.length > 0) {
            const orderLines = await this.connection.getRepository(ctx, core_1.OrderLine).find({
                where: { id: (0, typeorm_1.In)(allLineIds) },
                relations: ['productVariant', 'productVariant.product', 'productVariant.product.translations'],
            });
            for (const line of orderLines) {
                const translation = line.productVariant.product.translations.find(t => t.languageCode === ctx.languageCode);
                const productName = (_c = translation === null || translation === void 0 ? void 0 : translation.name) !== null && _c !== void 0 ? _c : '(未知)';
                lineMap.set(line.id, { productName, sku: line.productVariant.sku });
            }
        }
        // 5. 若有 self 物流，加载 LogisticsTrack 映射 trackingNo/carrierName
        //    注：LogisticsTrack 实体无 carrierName 列，resolver 约定以 carrierCode 作为展示名（同 logistics-shop.resolver.ts）
        const fulfillmentIds = packages
            .map(p => p.fulfillmentId)
            .filter((id) => id != null);
        const trackMap = new Map();
        if (fulfillmentIds.length > 0) {
            const repo = this.connection.getRepository(ctx, logistics_track_entity_1.LogisticsTrack);
            const tracks = await repo.find({ where: { fulfillmentId: (0, typeorm_1.In)(fulfillmentIds) } });
            for (const track of tracks) {
                trackMap.set(track.fulfillmentId, {
                    trackingNo: track.trackingNo,
                    carrierName: track.carrierCode,
                });
            }
        }
        // 6. 若有 city 配送，经 linker 获取骑手信息（linker 可选）
        const deliveryMap = new Map();
        const deliveryIds = packages
            .map(p => p.deliveryOrderId)
            .filter((id) => id != null);
        if (deliveryIds.length > 0 && this.deliveryShopLinker) {
            for (const deliveryId of deliveryIds) {
                const info = await this.deliveryShopLinker.getShopDelivery(ctx, deliveryId);
                deliveryMap.set(deliveryId, info);
            }
        }
        // 7. 组装返回结果
        const result = await Promise.all(packages.map(async (pkg, idx) => {
            var _a, _b, _c, _d, _e, _f;
            const lines = linesByPackage[idx];
            const richLines = lines.map(line => {
                var _a, _b;
                const rich = lineMap.get(line.orderLineId);
                return {
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                    productName: (_a = rich === null || rich === void 0 ? void 0 : rich.productName) !== null && _a !== void 0 ? _a : '(未知)',
                    sku: (_b = rich === null || rich === void 0 ? void 0 : rich.sku) !== null && _b !== void 0 ? _b : '',
                };
            });
            const track = pkg.fulfillmentId ? trackMap.get(pkg.fulfillmentId) : null;
            const delivery = pkg.deliveryOrderId ? deliveryMap.get(pkg.deliveryOrderId) : null;
            return {
                code: pkg.code,
                deliveryMode: pkg.deliveryMode,
                status: pkg.status,
                shippedAt: pkg.shippedAt,
                deliveredAt: pkg.deliveredAt,
                cancelledAt: pkg.cancelledAt,
                shippingFee: pkg.shippingFee,
                lines: richLines,
                trackingNo: (_a = track === null || track === void 0 ? void 0 : track.trackingNo) !== null && _a !== void 0 ? _a : null,
                carrierName: (_b = track === null || track === void 0 ? void 0 : track.carrierName) !== null && _b !== void 0 ? _b : null,
                courierName: (_c = delivery === null || delivery === void 0 ? void 0 : delivery.courierName) !== null && _c !== void 0 ? _c : null,
                courierPhone: (_d = delivery === null || delivery === void 0 ? void 0 : delivery.courierPhone) !== null && _d !== void 0 ? _d : null,
                thirdPartyNo: (_e = delivery === null || delivery === void 0 ? void 0 : delivery.thirdPartyNo) !== null && _e !== void 0 ? _e : null,
                etaMinutes: (_f = delivery === null || delivery === void 0 ? void 0 : delivery.etaMinutes) !== null && _f !== void 0 ? _f : null,
            };
        }));
        return result;
    }
};
exports.OrderPackageService = OrderPackageService;
exports.OrderPackageService = OrderPackageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], OrderPackageService);
//# sourceMappingURL=order-package.service.js.map