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
exports.R2ShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const r2_mark_service_1 = require("./r2-mark.service");
let R2ShopResolver = class R2ShopResolver {
    constructor(r2) {
        this.r2 = r2;
    }
    /** R2 原单卡「接力单状态」子卡数据源（动态反查，无写回） */
    async campusR2Relay(ctx, orderId) {
        return this.r2.relayStatus(ctx, orderId);
    }
};
exports.R2ShopResolver = R2ShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], R2ShopResolver.prototype, "campusR2Relay", null);
exports.R2ShopResolver = R2ShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [r2_mark_service_1.R2MarkService])
], R2ShopResolver);
//# sourceMappingURL=r2-shop.resolver.js.map