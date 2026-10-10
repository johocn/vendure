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
exports.HotelInventoryShopResolver = exports.HotelAvailabilityDay = void 0;
// 房态查询 Shop API（P1 Task 3）：C 端日历/DateBar 余量展示
// 窗口语义：[from, to] 含两端；每晚报价复用 calcNightlyPricing（单晚粒度，不叠加连住折扣）
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const hotel_inventory_service_1 = require("./hotel-inventory.service");
const hotel_inventory_logic_1 = require("./hotel-inventory-logic");
class HotelAvailabilityDay {
}
exports.HotelAvailabilityDay = HotelAvailabilityDay;
let HotelInventoryShopResolver = class HotelInventoryShopResolver {
    constructor(inventory) {
        this.inventory = inventory;
    }
    async hotelAvailability(ctx, variantId, from, to) {
        // getAvailability 为「含头不含尾」晚序列，窗口含尾日 → to+1
        return this.inventory.getAvailabilityDetailed(ctx, variantId, from, (0, hotel_inventory_logic_1.nextDate)(to));
    }
};
exports.HotelInventoryShopResolver = HotelInventoryShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('from')),
    __param(3, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], HotelInventoryShopResolver.prototype, "hotelAvailability", null);
exports.HotelInventoryShopResolver = HotelInventoryShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [hotel_inventory_service_1.HotelInventoryService])
], HotelInventoryShopResolver);
//# sourceMappingURL=hotel-inventory-shop.resolver.js.map