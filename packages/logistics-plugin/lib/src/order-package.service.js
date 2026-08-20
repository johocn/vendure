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
const constants_1 = require("./constants");
const order_package_entity_1 = require("./order-package.entity");
let OrderPackageService = class OrderPackageService {
    constructor(connection) {
        this.connection = connection;
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
};
exports.OrderPackageService = OrderPackageService;
exports.OrderPackageService = OrderPackageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], OrderPackageService);
//# sourceMappingURL=order-package.service.js.map