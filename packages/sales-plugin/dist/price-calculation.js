"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesOrderItemPriceCalculationStrategy = void 0;
// e:\code\vendure\packages\sales-plugin\src\price-calculation.ts
const common_1 = require("@nestjs/common");
/**
 * @description
 * 销售开单价格计算策略：当 OrderLine.customFields.overwrittenPrice 非 null 时使用改价，
 * 否则回退到 ProductVariant.listPrice 默认价。
 *
 * 注册到 config.orderOptions.orderItemPriceCalculationStrategy，全局生效但仅当
 * overwrittenPrice 非空时介入，不影响 vshop 客户下单。
 */
let SalesOrderItemPriceCalculationStrategy = class SalesOrderItemPriceCalculationStrategy {
    calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity) {
        const overwritten = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.overwrittenPrice;
        if (overwritten != null && overwritten > 0) {
            return { price: overwritten, priceIncludesTax: true };
        }
        return {
            price: productVariant.listPrice,
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
    }
};
exports.SalesOrderItemPriceCalculationStrategy = SalesOrderItemPriceCalculationStrategy;
exports.SalesOrderItemPriceCalculationStrategy = SalesOrderItemPriceCalculationStrategy = __decorate([
    (0, common_1.Injectable)()
], SalesOrderItemPriceCalculationStrategy);
