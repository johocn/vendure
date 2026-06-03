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
exports.FlashSaleShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const flash_sale_service_1 = require("./flash-sale.service");
let FlashSaleShopResolver = class FlashSaleShopResolver {
    constructor(flashSaleService) {
        this.flashSaleService = flashSaleService;
    }
    async activeFlashSaleActivities(ctx) {
        var _a;
        try {
            const result = await this.flashSaleService.findActive(ctx);
            core_1.Logger.info(`activeFlashSaleActivities returned ${(_a = result === null || result === void 0 ? void 0 : result.length) !== null && _a !== void 0 ? _a : 'null'} items`, constants_1.loggerCtx);
            return result !== null && result !== void 0 ? result : [];
        }
        catch (e) {
            core_1.Logger.error(`activeFlashSaleActivities error: ${e.message}`, constants_1.loggerCtx);
            return [];
        }
    }
};
exports.FlashSaleShopResolver = FlashSaleShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FlashSaleShopResolver.prototype, "activeFlashSaleActivities", null);
exports.FlashSaleShopResolver = FlashSaleShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [flash_sale_service_1.FlashSaleService])
], FlashSaleShopResolver);
//# sourceMappingURL=flash-sale-shop.resolver.js.map