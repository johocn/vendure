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
exports.ErrandService = exports.ERRAND_BASE_SKU = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
/** 0 元载体商品 SKU：幂等创建的查重键，C 端 addItemToOrder 用其 variantId 加购物车 */
exports.ERRAND_BASE_SKU = 'CAMPUS-ERRAND-BASE';
/**
 * R5 跑腿单：两步式链路——
 * 1) admin 用 ensureErrandProduct 幂等建 0 元载体（SKU 查重入口）；
 * 2) C 端先 addItemToOrder(variantId)，再 campusSetErrandInfo 写 errand 标记 + 小费 surcharge。
 * 支付金额 = 商品(0) + shipping(campusErrandCalculator 按 zone.fee) + surcharge(tip)；
 * 分成按 shipping + tip 计算（surcharge 不进 order.shipping，无双算）。
 */
let ErrandService = class ErrandService {
    constructor(connection, orderService, moduleRef) {
        this.connection = connection;
        this.orderService = orderService;
        this.moduleRef = moduleRef;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    /** 幂等创建 0 元载体：按 SKU 查 ProductVariant，已存在直接返回。
     * ProductVariant 有 product FK，必须走 ProductService/ProductVariantService 组合（禁裸 repo.save 单表）。 */
    async ensureErrandProduct(ctx) {
        const existing = await this.connection
            .getRepository(ctx, core_2.ProductVariant)
            .findOne({ where: { sku: exports.ERRAND_BASE_SKU } });
        if (existing) {
            return { variantId: existing.id, sku: exports.ERRAND_BASE_SKU, created: false };
        }
        const productService = this.injector.get(core_2.ProductService);
        const variantService = this.injector.get(core_2.ProductVariantService);
        const product = await productService.create(ctx, {
            translations: [{ languageCode: ctx.languageCode, name: '校园跑腿服务' }],
        });
        const [variant] = await variantService.create(ctx, [
            {
                productId: product.id,
                sku: exports.ERRAND_BASE_SKU,
                price: 0,
                translations: [{ languageCode: ctx.languageCode, name: '校园跑腿服务' }],
            },
        ]);
        return { variantId: variant.id, sku: exports.ERRAND_BASE_SKU, created: true };
    }
    /**
     * C 端跑腿单第二步：写 errand customFields（标记 orderKind/R5 + 起止 + 小费），
     * tip>0 时给订单加小费 surcharge（listPrice=tip，含税口径）。
     */
    async setErrandInfo(ctx, input) {
        var _a, _b, _c;
        if (!ctx.activeUserId)
            throw new core_2.ForbiddenError();
        const orderId = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId;
        if (!orderId)
            throw new core_2.UserInputError('购物车为空');
        if (!Number.isFinite(input.tip) || input.tip < 0)
            throw new core_2.UserInputError('小费金额不合法');
        const tip = Math.floor(input.tip);
        const order = await this.orderService.updateCustomFields(ctx, orderId, {
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: input.kind,
            errandFrom: input.fromText,
            errandTo: input.toText,
            tip,
            buildingId: (_b = input.buildingId) !== null && _b !== void 0 ? _b : null,
            campusZone: (_c = input.campusZone) !== null && _c !== void 0 ? _c : null,
        });
        if (tip > 0) {
            // 本 fork 无独立 SurchargeService，surcharge 原语在 OrderService.addSurchargeToOrder（service 层无权限校验，shop ctx 可用）
            await this.orderService.addSurchargeToOrder(ctx, orderId, {
                description: '跑腿小费',
                listPrice: tip,
                listPriceIncludesTax: true,
            });
        }
        return order;
    }
};
exports.ErrandService = ErrandService;
exports.ErrandService = ErrandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        core_2.OrderService,
        core_1.ModuleRef])
], ErrandService);
//# sourceMappingURL=errand.service.js.map