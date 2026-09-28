"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProductSurveyPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSurveyPlugin = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const product_survey_controller_1 = require("./product-survey.controller");
const product_survey_service_1 = require("./product-survey.service");
/**
 * 选品调研只读插件：提供 GET /product-survey/candidates。
 * 只读、无缓存、无自定义表；渠道由 vendure-token 解析。
 */
let ProductSurveyPlugin = ProductSurveyPlugin_1 = class ProductSurveyPlugin {
    static init(options = {}) {
        ProductSurveyPlugin_1.options = options;
        return ProductSurveyPlugin_1;
    }
};
exports.ProductSurveyPlugin = ProductSurveyPlugin;
ProductSurveyPlugin.options = {};
exports.ProductSurveyPlugin = ProductSurveyPlugin = ProductSurveyPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [product_survey_controller_1.ProductSurveyController],
        providers: [
            product_survey_service_1.ProductSurveyService,
            { provide: constants_1.PRODUCT_SURVEY_PLUGIN_OPTIONS, useFactory: () => ProductSurveyPlugin.options },
        ],
        compatibility: '^3.0.0',
    })
], ProductSurveyPlugin);
//# sourceMappingURL=plugin.js.map