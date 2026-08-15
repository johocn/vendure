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
exports.CASHIER_PAYMENT_PROFILE_CODE = exports.CASHIER_PAYMENT_METHOD_CODE = exports.STORE_PICKUP_PROFILE_CODE = exports.STORE_PICKUP_TEMPLATE_CODE = exports.STORE_PICKUP_METHOD_CODE = exports.DEFAULT_STORE = exports.DefaultDataService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const payment_profile_service_1 = require("../payment/payment-profile.service");
const pickup_location_entity_1 = require("../pickup/pickup-location.entity");
const shipping_profile_service_1 = require("../shipping/shipping-profile.service");
const shipping_template_entity_1 = require("../shipping/shipping-template.entity");
const shipping_template_service_1 = require("../shipping/shipping-template.service");
/**
 * 插件默认数据初始化
 *
 * 商品级配送/支付方案（ShippingProfile/PaymentProfile）建表后为空。
 * 本服务在 onApplicationBootstrap 阶段幂等创建一套全局默认数据，便于快速投入使用：
 * - 自提点（门店）
 * - 门店自提配送方式 + 配送模板 + 配送档案
 * - 门店收银支付方式 + 支付档案
 *
 * 默认数据均为全局档案（isGlobal=true），所有租户共享。
 * 通过 CjkPlugin.options.seedDefaultData = false 可禁用。
 */
let DefaultDataService = class DefaultDataService {
    constructor(connection, requestContextService, shippingMethodService, paymentMethodService, shippingTemplateService, shippingProfileService, paymentProfileService) {
        this.connection = connection;
        this.requestContextService = requestContextService;
        this.shippingMethodService = shippingMethodService;
        this.paymentMethodService = paymentMethodService;
        this.shippingTemplateService = shippingTemplateService;
        this.shippingProfileService = shippingProfileService;
        this.paymentProfileService = paymentProfileService;
    }
    /**
     * 幂等创建默认数据。任何单项失败仅记日志，不阻塞应用启动。
     */
    async seed() {
        try {
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            core_1.Logger.info('开始初始化购物配送/支付默认数据', constants_1.loggerCtx);
            await this.seedPickupLocation(ctx);
            await this.seedStorePickupMethod(ctx);
            await this.seedStorePickupTemplate(ctx);
            await this.seedStorePickupProfile(ctx);
            await this.seedCashierPaymentMethod(ctx);
            await this.seedCashierPaymentProfile(ctx);
            core_1.Logger.info('购物配送/支付默认数据初始化完成', constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`默认数据初始化失败: ${e.message}`, constants_1.loggerCtx);
        }
    }
    /** 默认门店自提点 */
    async seedPickupLocation(ctx) {
        const existing = await this.connection
            .getRepository(ctx, pickup_location_entity_1.PickupLocation)
            .findOne({ where: { name: exports.DEFAULT_STORE.name } });
        if (existing)
            return;
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = new pickup_location_entity_1.PickupLocation(Object.assign(Object.assign({}, exports.DEFAULT_STORE), { isPublic: true, ownerChannelId: null }));
        location.channels = [ctx.channel];
        await repo.save(location);
        core_1.Logger.info(`已创建默认自提点: ${exports.DEFAULT_STORE.name}`, constants_1.loggerCtx);
    }
    /** 门店自提配送方式 */
    async seedStorePickupMethod(ctx) {
        const existing = await this.connection
            .getRepository(ctx, 'ShippingMethod')
            .findOne({ where: { code: exports.STORE_PICKUP_METHOD_CODE } });
        if (existing)
            return;
        await this.shippingMethodService.create(ctx, {
            code: exports.STORE_PICKUP_METHOD_CODE,
            fulfillmentHandler: 'store-pickup',
            checker: { code: 'store-pickup-eligibility', arguments: [] },
            calculator: { code: 'store-pickup-calculator', arguments: [] },
            translations: [
                { languageCode: core_1.LanguageCode.zh_Hans, name: '门店自提', description: '到指定门店自提商品' },
                { languageCode: core_1.LanguageCode.en, name: 'Store Pickup', description: 'Pick up at the store' },
            ],
        });
        core_1.Logger.info(`已创建默认配送方式: ${exports.STORE_PICKUP_METHOD_CODE}`, constants_1.loggerCtx);
    }
    /** 门店自提配送模板 */
    async seedStorePickupTemplate(ctx) {
        const existing = await this.connection
            .getRepository(ctx, shipping_template_entity_1.ShippingTemplate)
            .findOne({ where: { code: exports.STORE_PICKUP_TEMPLATE_CODE } });
        if (existing)
            return;
        await this.shippingTemplateService.create(ctx, {
            name: '门店自提模板',
            description: '到指定门店自提',
            code: exports.STORE_PICKUP_TEMPLATE_CODE,
            fulfillmentHandler: 'store-pickup',
            checker: { code: 'store-pickup-eligibility', arguments: [] },
            calculator: { code: 'store-pickup-calculator', arguments: [] },
            isGlobal: true,
        });
        core_1.Logger.info(`已创建默认配送模板: ${exports.STORE_PICKUP_TEMPLATE_CODE}`, constants_1.loggerCtx);
    }
    /** 门店自提配送档案（关联配送方式 + 自提点） */
    async seedStorePickupProfile(ctx) {
        const existing = await this.shippingProfileService.findByCode(ctx, exports.STORE_PICKUP_PROFILE_CODE);
        if (existing)
            return;
        const method = await this.connection
            .getRepository(ctx, 'ShippingMethod')
            .findOne({ where: { code: exports.STORE_PICKUP_METHOD_CODE } });
        const location = await this.connection
            .getRepository(ctx, pickup_location_entity_1.PickupLocation)
            .findOne({ where: { name: exports.DEFAULT_STORE.name } });
        if (!method) {
            core_1.Logger.warn(`配送方式 ${exports.STORE_PICKUP_METHOD_CODE} 不存在，跳过配送档案`, constants_1.loggerCtx);
            return;
        }
        await this.shippingProfileService.create(ctx, {
            name: '门店自提配送档案',
            description: '到指定门店自提',
            code: exports.STORE_PICKUP_PROFILE_CODE,
            isGlobal: true,
            shippingMethodIds: [method.id],
            pickupLocationIds: location ? [location.id] : [],
        });
        core_1.Logger.info(`已创建默认配送档案: ${exports.STORE_PICKUP_PROFILE_CODE}`, constants_1.loggerCtx);
    }
    /** 门店收银支付方式（货到付款处理器） */
    async seedCashierPaymentMethod(ctx) {
        const existing = await this.connection
            .getRepository(ctx, 'PaymentMethod')
            .findOne({ where: { code: exports.CASHIER_PAYMENT_METHOD_CODE } });
        if (existing)
            return;
        await this.paymentMethodService.create(ctx, {
            code: exports.CASHIER_PAYMENT_METHOD_CODE,
            enabled: true,
            handler: { code: 'cash-on-delivery', arguments: [] },
            translations: [
                { languageCode: core_1.LanguageCode.zh_Hans, name: '门店收银', description: '到店扫码/收银台支付' },
                { languageCode: core_1.LanguageCode.en, name: 'Store Cashier', description: 'Pay at the store cashier' },
            ],
        });
        core_1.Logger.info(`已创建默认支付方式: ${exports.CASHIER_PAYMENT_METHOD_CODE}`, constants_1.loggerCtx);
    }
    /** 门店收银支付档案 */
    async seedCashierPaymentProfile(ctx) {
        const existing = await this.paymentProfileService.findByCode(ctx, exports.CASHIER_PAYMENT_PROFILE_CODE);
        if (existing)
            return;
        const method = await this.connection
            .getRepository(ctx, 'PaymentMethod')
            .findOne({ where: { code: exports.CASHIER_PAYMENT_METHOD_CODE } });
        if (!method) {
            core_1.Logger.warn(`支付方式 ${exports.CASHIER_PAYMENT_METHOD_CODE} 不存在，跳过支付档案`, constants_1.loggerCtx);
            return;
        }
        await this.paymentProfileService.create(ctx, {
            name: '门店收银支付档案',
            description: '到店收银台支付',
            code: exports.CASHIER_PAYMENT_PROFILE_CODE,
            isGlobal: true,
            paymentMethodIds: [method.id],
        });
        core_1.Logger.info(`已创建默认支付档案: ${exports.CASHIER_PAYMENT_PROFILE_CODE}`, constants_1.loggerCtx);
    }
};
exports.DefaultDataService = DefaultDataService;
exports.DefaultDataService = DefaultDataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.RequestContextService,
        core_1.ShippingMethodService,
        core_1.PaymentMethodService,
        shipping_template_service_1.ShippingTemplateService,
        shipping_profile_service_1.ShippingProfileService,
        payment_profile_service_1.PaymentProfileService])
], DefaultDataService);
exports.DEFAULT_STORE = {
    name: '自由大路店',
    type: 'store',
    address: '自由大路',
    phoneNumber: '',
    businessHours: '09:00-21:00',
};
exports.STORE_PICKUP_METHOD_CODE = 'store-pickup';
exports.STORE_PICKUP_TEMPLATE_CODE = 'store-pickup-template';
exports.STORE_PICKUP_PROFILE_CODE = 'store-pickup-profile';
exports.CASHIER_PAYMENT_METHOD_CODE = 'cash-on-delivery';
exports.CASHIER_PAYMENT_PROFILE_CODE = 'store-cashier-profile';
//# sourceMappingURL=default-data.service.js.map