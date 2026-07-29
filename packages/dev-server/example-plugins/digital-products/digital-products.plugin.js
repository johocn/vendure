"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalProductsPlugin = void 0;
const core_1 = require("@vendure/core");
require("./types");
const digital_fulfillment_handler_1 = require("./config/digital-fulfillment-handler");
const digital_order_process_1 = require("./config/digital-order-process");
const digital_shipping_eligibility_checker_1 = require("./config/digital-shipping-eligibility-checker");
const digital_shipping_line_assignment_strategy_1 = require("./config/digital-shipping-line-assignment-strategy");
/**
 * @description
 * This is an example plugin which demonstrates how to add support for digital products.
 */
let DigitalProductsPlugin = class DigitalProductsPlugin {
};
exports.DigitalProductsPlugin = DigitalProductsPlugin;
exports.DigitalProductsPlugin = DigitalProductsPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: config => {
            config.customFields.ProductVariant.push({
                type: 'boolean',
                name: 'isDigital',
                defaultValue: false,
                label: [{ languageCode: core_1.LanguageCode.en, value: 'This product is digital' }],
                public: true,
            });
            config.customFields.ShippingMethod.push({
                type: 'boolean',
                name: 'isDigital',
                defaultValue: false,
                label: [
                    { languageCode: core_1.LanguageCode.en, value: 'This shipping method handles digital products' },
                ],
                public: true,
            });
            config.customFields.Fulfillment.push({
                type: 'string',
                name: 'downloadUrls',
                nullable: true,
                list: true,
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Urls of any digital purchases' }],
                public: true,
            });
            config.shippingOptions.fulfillmentHandlers.push(digital_fulfillment_handler_1.digitalFulfillmentHandler);
            config.shippingOptions.shippingLineAssignmentStrategy = new digital_shipping_line_assignment_strategy_1.DigitalShippingLineAssignmentStrategy();
            config.shippingOptions.shippingEligibilityCheckers.push(digital_shipping_eligibility_checker_1.digitalShippingEligibilityChecker);
            config.orderOptions.process.push(digital_order_process_1.digitalOrderProcess);
            return config;
        },
        compatibility: '^3.0.0',
    })
], DigitalProductsPlugin);
//# sourceMappingURL=digital-products.plugin.js.map