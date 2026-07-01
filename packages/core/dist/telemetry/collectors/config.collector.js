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
exports.ConfigCollector = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../../config/config.service");
const strategy_name_helper_1 = require("../helpers/strategy-name.helper");
/**
 * Collects configuration information for telemetry.
 * Only collects strategy class names and non-sensitive configuration values.
 */
let ConfigCollector = class ConfigCollector {
    constructor(configService) {
        this.configService = configService;
    }
    collect() {
        const customFieldsPerEntity = this.getCustomFieldsPerEntity();
        const customFieldsCount = Object.values(customFieldsPerEntity).reduce((sum, c) => sum + c, 0);
        return {
            assetStorageType: this.getAssetStorageType(),
            jobQueueType: this.getJobQueueType(),
            entityIdStrategy: this.getEntityIdStrategy(),
            defaultLanguage: this.getDefaultLanguage(),
            customFieldsCount,
            authenticationMethods: this.getAuthenticationMethods(),
            moneyStrategy: this.getMoneyStrategy(),
            cacheStrategy: this.getCacheStrategy(),
            taxLineCalculationStrategy: this.getTaxLineCalculationStrategy(),
            orderSellerStrategy: this.getOrderSellerStrategy(),
            paymentHandlerCodes: this.getPaymentHandlerCodes(),
            shippingCalculatorCodes: this.getShippingCalculatorCodes(),
            fulfillmentHandlerCodes: this.getFulfillmentHandlerCodes(),
            promotionConditionCount: this.getPromotionConditionCount(),
            promotionActionCount: this.getPromotionActionCount(),
            scheduledTaskCount: this.getScheduledTaskCount(),
            customFieldsPerEntity,
            hasCustomOrderProcess: this.hasCustomOrderProcess(),
            hasCustomPaymentProcess: this.hasCustomPaymentProcess(),
            hasCustomFulfillmentProcess: this.hasCustomFulfillmentProcess(),
        };
    }
    getDefaultLanguage() {
        try {
            return this.configService.defaultLanguageCode;
        }
        catch (_a) {
            return undefined;
        }
    }
    getAssetStorageType() {
        try {
            return (0, strategy_name_helper_1.getStrategyName)(this.configService.assetOptions.assetStorageStrategy);
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getJobQueueType() {
        try {
            return (0, strategy_name_helper_1.getStrategyName)(this.configService.jobQueueOptions.jobQueueStrategy);
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getEntityIdStrategy() {
        var _a;
        try {
            const strategy = (_a = this.configService.entityOptions.entityIdStrategy) !== null && _a !== void 0 ? _a : this.configService.entityIdStrategy;
            return strategy ? (0, strategy_name_helper_1.getStrategyName)(strategy) : 'unknown';
        }
        catch (_b) {
            return 'unknown';
        }
    }
    getAuthenticationMethods() {
        try {
            const methods = new Set();
            const adminStrategies = this.configService.authOptions.adminAuthenticationStrategy;
            const shopStrategies = this.configService.authOptions.shopAuthenticationStrategy;
            for (const strategy of adminStrategies) {
                methods.add((0, strategy_name_helper_1.getStrategyName)(strategy));
            }
            for (const strategy of shopStrategies) {
                methods.add((0, strategy_name_helper_1.getStrategyName)(strategy));
            }
            return Array.from(methods).sort((a, b) => a.localeCompare(b));
        }
        catch (_a) {
            return [];
        }
    }
    getMoneyStrategy() {
        try {
            const strategy = this.configService.entityOptions.moneyStrategy;
            return strategy ? (0, strategy_name_helper_1.getStrategyName)(strategy) : 'unknown';
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getCacheStrategy() {
        try {
            return (0, strategy_name_helper_1.getStrategyName)(this.configService.systemOptions.cacheStrategy);
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getTaxLineCalculationStrategy() {
        try {
            return (0, strategy_name_helper_1.getStrategyName)(this.configService.taxOptions.taxLineCalculationStrategy);
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getOrderSellerStrategy() {
        try {
            const strategy = this.configService.orderOptions.orderSellerStrategy;
            return strategy ? (0, strategy_name_helper_1.getStrategyName)(strategy) : 'unknown';
        }
        catch (_a) {
            return 'unknown';
        }
    }
    getPaymentHandlerCodes() {
        try {
            return this.configService.paymentOptions.paymentMethodHandlers.map(h => h.code);
        }
        catch (_a) {
            return [];
        }
    }
    getShippingCalculatorCodes() {
        try {
            return this.configService.shippingOptions.shippingCalculators.map(c => c.code);
        }
        catch (_a) {
            return [];
        }
    }
    getFulfillmentHandlerCodes() {
        try {
            return this.configService.shippingOptions.fulfillmentHandlers.map(h => h.code);
        }
        catch (_a) {
            return [];
        }
    }
    getPromotionConditionCount() {
        var _a, _b;
        try {
            return (_b = (_a = this.configService.promotionOptions.promotionConditions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        }
        catch (_c) {
            return 0;
        }
    }
    getPromotionActionCount() {
        var _a, _b;
        try {
            return (_b = (_a = this.configService.promotionOptions.promotionActions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        }
        catch (_c) {
            return 0;
        }
    }
    getScheduledTaskCount() {
        var _a, _b;
        try {
            return (_b = (_a = this.configService.schedulerOptions.tasks) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        }
        catch (_c) {
            return 0;
        }
    }
    getCustomFieldsPerEntity() {
        try {
            const customFields = this.configService.customFields;
            const result = {};
            for (const entityName of Object.keys(customFields)) {
                const fields = customFields[entityName];
                if (Array.isArray(fields) && fields.length > 0) {
                    result[entityName] = fields.length;
                }
            }
            return result;
        }
        catch (_a) {
            return {};
        }
    }
    hasCustomOrderProcess() {
        var _a, _b;
        try {
            return ((_b = (_a = this.configService.orderOptions.process) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0;
        }
        catch (_c) {
            return false;
        }
    }
    hasCustomPaymentProcess() {
        var _a, _b;
        try {
            return ((_b = (_a = this.configService.paymentOptions.process) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0;
        }
        catch (_c) {
            return false;
        }
    }
    hasCustomFulfillmentProcess() {
        var _a, _b;
        try {
            return ((_b = (_a = this.configService.shippingOptions.process) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0;
        }
        catch (_c) {
            return false;
        }
    }
};
exports.ConfigCollector = ConfigCollector;
exports.ConfigCollector = ConfigCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], ConfigCollector);
//# sourceMappingURL=config.collector.js.map