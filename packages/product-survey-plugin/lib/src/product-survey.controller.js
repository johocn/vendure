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
exports.ProductSurveyController = exports.InvalidChannelTokenFilter = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const product_survey_service_1 = require("./product-survey.service");
/**
 * 渠道 token 非法的 400 兜底。
 * vendure-token 由 AuthGuard → RequestContextService.fromRequest 在进入控制器前解析，
 * 抛出的 ChannelNotFoundError 属 I18nError；Vendure 全局 ExceptionLoggerFilter 仅把
 * FORBIDDEN / UNAUTHORIZED / USER_INPUT_ERROR / ILLEGAL_OPERATION 映射为 4xx，
 * CHANNEL_NOT_FOUND 一律落 500，控制器内的 BadRequestException 分支执行不到。
 * 故在控制器级兜住（只影响本插件路由），响应结构对齐全局过滤器。
 */
let InvalidChannelTokenFilter = class InvalidChannelTokenFilter {
    catch(exception, host) {
        var _a, _b;
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        res.status(400).json({
            statusCode: 400,
            message: `无效的渠道 token: ${(_b = (_a = exception.variables) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : ''}`,
            timestamp: new Date().toISOString(),
            path: req.url,
        });
    }
};
exports.InvalidChannelTokenFilter = InvalidChannelTokenFilter;
exports.InvalidChannelTokenFilter = InvalidChannelTokenFilter = __decorate([
    (0, common_1.Catch)(core_1.ChannelNotFoundError)
], InvalidChannelTokenFilter);
/**
 * 只读候选商品端点：GET /product-survey/candidates
 * 免登录；渠道由请求头 vendure-token 解析（缺省为默认渠道，非法 token → 400）。
 * 参数：
 *  - productIds：逗号分隔的商品 id，优先级最高；返回顺序严格等于传入顺序，查不到的丢弃
 *  - collection：Collection slug
 *  - onsale：值为 1 时返回该渠道全部上架在售商品
 *  - take：默认 50，上限 100
 */
let ProductSurveyController = class ProductSurveyController {
    constructor(productSurveyService) {
        this.productSurveyService = productSurveyService;
    }
    getCandidates(vendureToken, productIds, collection, onsale, take) {
        return this.productSurveyService.getCandidates(vendureToken, {
            productIds,
            collection,
            onsale,
            take,
        });
    }
};
exports.ProductSurveyController = ProductSurveyController;
__decorate([
    (0, common_1.Get)('candidates'),
    __param(0, (0, common_1.Headers)('vendure-token')),
    __param(1, (0, common_1.Query)('productIds')),
    __param(2, (0, common_1.Query)('collection')),
    __param(3, (0, common_1.Query)('onsale')),
    __param(4, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductSurveyController.prototype, "getCandidates", null);
exports.ProductSurveyController = ProductSurveyController = __decorate([
    (0, common_1.UseFilters)(InvalidChannelTokenFilter),
    (0, common_1.Controller)('product-survey'),
    __metadata("design:paramtypes", [product_survey_service_1.ProductSurveyService])
], ProductSurveyController);
//# sourceMappingURL=product-survey.controller.js.map