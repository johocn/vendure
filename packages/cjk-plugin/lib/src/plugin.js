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
var CjkPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CjkPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const core_2 = require("@nestjs/core");
const constants_1 = require("./constants");
const cod_handler_1 = require("./payment/cod-handler");
const coupon_stackable_condition_1 = require("./promotion/coupon-stackable-condition");
const promotion_custom_fields_1 = require("./promotion/promotion-custom-fields");
const pickup_calculator_1 = require("./pickup/pickup-calculator");
const pickup_eligibility_checker_1 = require("./pickup/pickup-eligibility-checker");
const pickup_fulfillment_handler_1 = require("./pickup/pickup-fulfillment-handler");
const pickup_location_entity_1 = require("./pickup/pickup-location.entity");
const tenant_channel_custom_fields_1 = require("./tenant/tenant-channel-custom-fields");
const tenant_setup_service_1 = require("./tenant/tenant-setup.service");
let CjkPlugin = CjkPlugin_1 = class CjkPlugin {
    constructor(options, moduleRef) {
        this.options = options;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        CjkPlugin_1.options = options;
        return CjkPlugin_1;
    }
    async onApplicationBootstrap() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (((_a = this.options.i18n) === null || _a === void 0 ? void 0 : _a.enabled) !== false) {
            const i18nService = this.moduleRef.get(core_1.I18nService);
            const languages = ((_b = this.options.i18n) === null || _b === void 0 ? void 0 : _b.languages) || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
            const translations = {
                zh_Hans: await import('./i18n/zh_CN.json'),
                zh_Hant: await import('./i18n/zh_TW.json'),
                ja: await import('./i18n/ja.json'),
                ko: await import('./i18n/ko.json'),
            };
            for (const lang of languages) {
                if (translations[lang]) {
                    i18nService.addTranslation(lang, translations[lang]);
                    core_1.Logger.info(`Registered i18n translation for ${lang}`, constants_1.loggerCtx);
                }
            }
        }
        if (((_c = this.options.regions) === null || _c === void 0 ? void 0 : _c.enabled) !== false) {
            core_1.Logger.info('CJK regions module enabled - use RegionPopulator in your server bootstrap to populate countries', constants_1.loggerCtx);
        }
        if ((_d = this.options.cod) === null || _d === void 0 ? void 0 : _d.enabled) {
            core_1.Logger.info('Cash on Delivery payment module enabled', constants_1.loggerCtx);
        }
        if ((_e = this.options.storePickup) === null || _e === void 0 ? void 0 : _e.enabled) {
            core_1.Logger.info('Store pickup shipping module enabled', constants_1.loggerCtx);
        }
        if ((_f = this.options.pickupPoint) === null || _f === void 0 ? void 0 : _f.enabled) {
            core_1.Logger.info('Pickup point shipping module enabled', constants_1.loggerCtx);
        }
        if ((_g = this.options.promotionPolicy) === null || _g === void 0 ? void 0 : _g.enabled) {
            core_1.Logger.info('Promotion stacking policy module enabled', constants_1.loggerCtx);
        }
        if ((_h = this.options.tenant) === null || _h === void 0 ? void 0 : _h.enabled) {
            core_1.Logger.info('Tenant (multi-channel) module enabled', constants_1.loggerCtx);
        }
    }
    configure(consumer) { }
};
exports.CjkPlugin = CjkPlugin;
exports.CjkPlugin = CjkPlugin = CjkPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [pickup_location_entity_1.PickupLocation],
        providers: [
            { provide: constants_1.CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options },
            tenant_setup_service_1.TenantSetupService,
        ],
        configuration: config => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if ((_a = CjkPlugin.options.cod) === null || _a === void 0 ? void 0 : _a.enabled) {
                config.paymentOptions.paymentMethodHandlers = [
                    ...(config.paymentOptions.paymentMethodHandlers || []),
                    cod_handler_1.codPaymentHandler,
                ];
            }
            const hasPickup = ((_b = CjkPlugin.options.storePickup) === null || _b === void 0 ? void 0 : _b.enabled) || ((_c = CjkPlugin.options.pickupPoint) === null || _c === void 0 ? void 0 : _c.enabled);
            if (hasPickup) {
                config.shippingOptions = config.shippingOptions || {};
                config.shippingOptions.shippingEligibilityCheckers = [
                    ...(config.shippingOptions.shippingEligibilityCheckers || []),
                ];
                config.shippingOptions.shippingCalculators = [
                    ...(config.shippingOptions.shippingCalculators || []),
                ];
                config.shippingOptions.fulfillmentHandlers = [
                    ...(config.shippingOptions.fulfillmentHandlers || []),
                ];
                if ((_d = CjkPlugin.options.storePickup) === null || _d === void 0 ? void 0 : _d.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.storePickupEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.storePickupCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.storePickupFulfillmentHandler);
                }
                if ((_e = CjkPlugin.options.pickupPoint) === null || _e === void 0 ? void 0 : _e.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.pickupPointEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.pickupPointCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.pickupPointFulfillmentHandler);
                }
            }
            if ((_f = CjkPlugin.options.promotionPolicy) === null || _f === void 0 ? void 0 : _f.enabled) {
                config.promotionOptions = config.promotionOptions || {};
                config.promotionOptions.promotionConditions = [
                    ...(config.promotionOptions.promotionConditions || []),
                    coupon_stackable_condition_1.couponStackableCondition,
                ];
                config.customFields = Object.assign(Object.assign({}, config.customFields), { Promotion: [
                        ...(((_g = config.customFields) === null || _g === void 0 ? void 0 : _g.Promotion) || []),
                        ...promotion_custom_fields_1.promotionCustomFields.Promotion,
                    ] });
            }
            if ((_h = CjkPlugin.options.tenant) === null || _h === void 0 ? void 0 : _h.enabled) {
                config.customFields = Object.assign(Object.assign({}, config.customFields), { Channel: [
                        ...(((_j = config.customFields) === null || _j === void 0 ? void 0 : _j.Channel) || []),
                        ...tenant_channel_custom_fields_1.tenantChannelCustomFields.Channel,
                    ] });
            }
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.CJK_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_2.ModuleRef])
], CjkPlugin);
//# sourceMappingURL=plugin.js.map