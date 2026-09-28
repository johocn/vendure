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
exports.ProductSurveyController = void 0;
const common_1 = require("@nestjs/common");
const product_survey_service_1 = require("./product-survey.service");
/**
 * 只读候选商品端点：GET /product-survey/candidates
 * 免登录；渠道由请求头 vendure-token 解析（缺省为默认渠道）。
 * 参数：
 *  - collection：Collection slug（选品调研必填）
 *  - onsale：值为 1 时返回该渠道全部上架在售商品；与 collection 同时传时以 collection 优先
 *  - take：默认 50，上限 100
 */
let ProductSurveyController = class ProductSurveyController {
    constructor(productSurveyService) {
        this.productSurveyService = productSurveyService;
    }
    getCandidates(vendureToken, collection, onsale, take) {
        return this.productSurveyService.getCandidates(vendureToken, { collection, onsale, take });
    }
};
exports.ProductSurveyController = ProductSurveyController;
__decorate([
    (0, common_1.Get)('candidates'),
    __param(0, (0, common_1.Headers)('vendure-token')),
    __param(1, (0, common_1.Query)('collection')),
    __param(2, (0, common_1.Query)('onsale')),
    __param(3, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductSurveyController.prototype, "getCandidates", null);
exports.ProductSurveyController = ProductSurveyController = __decorate([
    (0, common_1.Controller)('product-survey'),
    __metadata("design:paramtypes", [product_survey_service_1.ProductSurveyService])
], ProductSurveyController);
//# sourceMappingURL=product-survey.controller.js.map