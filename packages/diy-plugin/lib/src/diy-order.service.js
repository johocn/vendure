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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiyOrderService = exports.DiyOrderItemPriceCalculationStrategy = void 0;
exports.ensureCarrierProduct = ensureCarrierProduct;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const calc_bridge_1 = require("./calc-bridge");
const diy_shop_service_1 = require("./diy-shop.service");
const diy_stock_service_1 = require("./diy-stock.service");
const diy_plan_entity_1 = require("./entities/diy-plan.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
/**
 * DIY 成品行定价：OrderLine.customFields.diyUnitPrice > 0 时按它定价（BOM 金额为含税口径、单位分），
 * 否则委托原策略（sales-plugin 改价 / 默认标价）——包装委托式，不影响普通商品（与 sales-plugin 同哲学）。
 */
let DiyOrderItemPriceCalculationStrategy = class DiyOrderItemPriceCalculationStrategy {
    constructor(original) {
        this.original = original;
    }
    calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity) {
        const diyUnitPrice = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.diyUnitPrice;
        if (diyUnitPrice != null && diyUnitPrice > 0) {
            return { price: diyUnitPrice, priceIncludesTax: true };
        }
        if (this.original) {
            return this.original.calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity);
        }
        return { price: productVariant.listPrice, priceIncludesTax: productVariant.listPriceIncludesTax };
    }
};
exports.DiyOrderItemPriceCalculationStrategy = DiyOrderItemPriceCalculationStrategy;
exports.DiyOrderItemPriceCalculationStrategy = DiyOrderItemPriceCalculationStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], DiyOrderItemPriceCalculationStrategy);
/**
 * 载体商品（偏差 2）：bootstrap 幂等创建。enabled=true 才能过 addItemsToOrder 强校验；
 * 实际价格由 diyUnitPrice 覆盖；trackInventory=FALSE（库存由素材侧扣）；仅默认渠道。
 * 逐实体分步 save（不依赖级联）；价格行落 ProductVariantPrice，listPrice 运行时由它算出。
 */
async function ensureCarrierProduct(connection) {
    const variantRepo = connection.getRepository(core_1.ProductVariant);
    const existing = await variantRepo.findOne({ where: { sku: constants_1.CARRIER_VARIANT_SKU } });
    if (existing) {
        return;
    }
    const taxCategory = await connection.getRepository(core_1.TaxCategory).findOne({ where: {} });
    // 插件 bootstrap 先于测试 populate 执行，税类表可能为空：兜底创建，否则载体变体 taxCategory=null，
    // 下单时 core 的 applyChannelPriceAndTax 读取 variant.taxCategory.id 会崩（无税率行时 getApplicableTaxRate 有默认税率兜底）
    const resolvedTaxCategory = taxCategory !== null && taxCategory !== void 0 ? taxCategory : (await connection.getRepository(core_1.TaxCategory).save(new core_1.TaxCategory({ name: 'Standard' })));
    const channel = await connection.getRepository(core_1.Channel).findOne({ where: { code: '__default_channel__' } });
    const product = await connection.getRepository(core_1.Product).save(new core_1.Product({ enabled: true, channels: channel ? [channel] : [] }));
    await connection.getRepository(core_1.ProductTranslation).save(new core_1.ProductTranslation({
        languageCode: core_1.LanguageCode.zh_Hans,
        name: constants_1.CARRIER_PRODUCT_NAME,
        slug: constants_1.CARRIER_PRODUCT_SLUG,
        description: 'DIY 定制成品载体，请通过 DIY 设计器下单',
        base: product,
    }));
    const variant = await variantRepo.save(new core_1.ProductVariant({
        sku: constants_1.CARRIER_VARIANT_SKU,
        enabled: true,
        trackInventory: generated_types_1.GlobalFlag.FALSE,
        taxCategory: resolvedTaxCategory,
        product,
        channels: channel ? [channel] : [],
    }));
    await connection.getRepository(core_1.ProductVariantTranslation).save(new core_1.ProductVariantTranslation({ languageCode: core_1.LanguageCode.zh_Hans, name: constants_1.CARRIER_PRODUCT_NAME, base: variant }));
    await connection.getRepository(core_1.ProductVariantPrice).save(new core_1.ProductVariantPrice({ price: 0, currencyCode: core_1.CurrencyCode.CNY, variant }));
    core_1.Logger.info('[DiyPlugin] carrier product ensured', constants_1.loggerCtx);
}
/**
 * 方案成单（规格 §6.3）：归属校验 → 服务端实时价复算 → 原子扣库存 → 建单挂 DIY 自定义订单行 → 回写 plan。
 * 全程包在事务里：任一步抛错整体回滚（含已扣库存），无需手动补偿。
 */
let DiyOrderService = class DiyOrderService {
    constructor(options, connection, orderService, shopService, stockService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.shopService = shopService;
        this.stockService = stockService;
    }
    get app() {
        var _a;
        return (_a = this.options.app) !== null && _a !== void 0 ? _a : 'nshop';
    }
    async createOrderFromPlan(ctx, planId) {
        const activeUserId = ctx.activeUserId;
        if (!activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const userId = Number(activeUserId);
        return this.connection.withTransaction(ctx, async (tctx) => {
            const planRepo = this.connection.getRepository(tctx, diy_plan_entity_1.DiyPlan);
            const plan = await planRepo.findOne({ where: { app: this.app, id: Number(planId) } });
            // v2：归属校验放宽为 owner 或 isPublic=true（他人公开方案可一键复购下单）
            if (!plan || (plan.userId !== userId && !plan.isPublic)) {
                throw new core_1.UserInputError(`Diy plan not found: ${planId}`);
            }
            if (plan.status === 'ordered') {
                throw new core_1.UserInputError(`Diy plan ${plan.id} already ordered`);
            }
            const template = await this.connection
                .getRepository(tctx, diy_template_entity_1.DiyTemplate)
                .findOne({ where: { id: plan.templateId } });
            if (!template || template.status !== 'enabled') {
                throw new core_1.UserInputError(`Diy template not available`);
            }
            // 服务端实时价为唯一成交价；报价价（创建/最近一次报价时的快照）留作参考价
            const quoteRefAmount = plan.bom.totalAmount;
            const materialList = await this.shopService.findShopMaterials(tctx, { onlyEnabled: true, take: 100000 });
            let bom;
            try {
                bom = (0, calc_bridge_1.runDiyCalc)(template, plan.spec, materialList.items, tctx.languageCode).bom;
            }
            catch (e) {
                throw new core_1.UserInputError(e.message);
            }
            const stockItems = bom.items.map(i => ({ materialId: Number(i.materialId), qty: i.qty }));
            const shortages = await this.stockService.deduct(tctx, stockItems);
            if (shortages.length) {
                // 抛错 → 事务回滚，已扣行自动还原（deduct 内部补偿在此场景是冗余但无害）
                throw new core_1.UserInputError(`库存不足: ` +
                    shortages.map(s => `${s.code} 需 ${s.required} 现存 ${s.available}`).join('; '));
            }
            const variant = await this.connection
                .getRepository(tctx, core_1.ProductVariant)
                .findOne({ where: { sku: constants_1.CARRIER_VARIANT_SKU } });
            if (!variant) {
                throw new Error(`Carrier variant ${constants_1.CARRIER_VARIANT_SKU} missing (ensureCarrierProduct 未运行?)`);
            }
            const order = await this.orderService.create(tctx, userId);
            const result = await this.orderService.addItemToOrder(tctx, order.id, variant.id, 1, {
                diyPlanId: plan.id,
                diyUnitPrice: bom.totalAmount,
                diyBom: JSON.stringify(bom),
                diyQuoteRefAmount: quoteRefAmount,
                // v2：下单他人公开方案时记录原作者 userId（自购为 null）
                copiedFrom: plan.userId !== userId ? plan.userId : null,
            }, ['lines']);
            if (!(result instanceof core_1.Order)) {
                throw new core_1.UserInputError(result.errorCode);
            }
            plan.status = 'ordered';
            plan.orderLineId = Number(result.lines[result.lines.length - 1].id);
            await planRepo.save(plan);
            return plan;
        });
    }
};
exports.DiyOrderService = DiyOrderService;
exports.DiyOrderService = DiyOrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        diy_shop_service_1.DiyShopService,
        diy_stock_service_1.DiyStockService])
], DiyOrderService);
//# sourceMappingURL=diy-order.service.js.map