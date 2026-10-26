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
exports.MerchantAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const merchant_admin_service_1 = require("./merchant-admin.service");
/** JSON 字符串入参解析：语法错误直接以 UserInputError 反馈给后台，避免落库脏数据 */
function parseJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (_a) {
        throw new core_1.UserInputError('配置格式不合法（JSON 解析失败）');
    }
}
/** 逐条解析 JSON 字符串数组（空元素跳过） */
function parseJsonList(raw) {
    return (raw !== null && raw !== void 0 ? raw : []).filter(s => String(s !== null && s !== void 0 ? s : '').trim() !== '').map(s => parseJson(String(s)));
}
let MerchantAdminResolver = class MerchantAdminResolver {
    constructor(merchant) {
        this.merchant = merchant;
    }
    /** 商家接单工作台看板：本渠道待接单/备餐中/待取货/配送中 + 今日完成 */
    async campusMerchantBoard(ctx) {
        return this.merchant.board(ctx);
    }
    async campusMerchantAcceptOrder(ctx, orderId) {
        return this.merchant.acceptOrder(ctx, orderId);
    }
    /** 商家侧顾客联系方式（号码保护）：开启后仅返回脱敏/虚拟号 */
    async campusMerchantCustomerContact(ctx, orderId) {
        return this.merchant.customerContact(ctx, orderId);
    }
    async campusMerchantCookingDone(ctx, orderId) {
        return this.merchant.cookingDone(ctx, orderId);
    }
    /** 商家拒单/缺货：全额退款并取消订单（接单前或备餐中可用） */
    async campusMerchantRejectOrder(ctx, orderId, reason) {
        return this.merchant.rejectOrder(ctx, orderId, reason);
    }
    /** 营业中开关（本渠道 paused） */
    async campusMerchantSetPaused(ctx, paused) {
        return this.merchant.setPaused(ctx, paused);
    }
    /** 小票打印回执：打印成功后回写 waimaiPrintedAt（防重打 + 补打依据） */
    async campusMerchantMarkPrinted(ctx, orderId) {
        return this.merchant.markPrinted(ctx, orderId);
    }
    /** 一键沽清：本店商品列表（含售罄标记） */
    async campusMerchantProducts(ctx, search, skip, take) {
        return this.merchant.products(ctx, search, skip, take);
    }
    /** 沽清 / 取消沽清（售罄仍展示、不可加购） */
    async campusMerchantSetProductSoldOut(ctx, productId, soldOut) {
        return this.merchant.setProductSoldOut(ctx, productId, soldOut);
    }
    /** 商品级打包费（分/件）：null 清除回落店铺配置 */
    async campusMerchantSetProductPackingFee(ctx, productId, packingFee) {
        return this.merchant.setProductPackingFee(ctx, productId, packingFee !== null && packingFee !== void 0 ? packingFee : null);
    }
    /** 商品加料组（P1-2）：传空数组清除 */
    async campusMerchantSetProductAddonGroups(ctx, productId, groups) {
        return this.merchant.setProductAddonGroups(ctx, productId, parseJsonList(groups));
    }
    /** 商品套餐内容（P1-2）：传 null 清除 */
    async campusMerchantSetProductCombo(ctx, productId, combo) {
        return this.merchant.setProductCombo(ctx, productId, combo ? parseJson(combo) : null);
    }
    /** 推送外部快递：provider = dada | meituan（由运营中心在派单时选择） */
    async campusMerchantDispatchExternal(ctx, orderId, provider) {
        return this.merchant.dispatchExternal(ctx, orderId, provider);
    }
    /** 取消外部快递（改推另一家前先取消，或运力失败回落） */
    async campusMerchantCancelExternal(ctx, orderId, reason) {
        return this.merchant.cancelExternal(ctx, orderId, reason);
    }
    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    async campusMerchantAcceptOwned(ctx, orderId) {
        return this.merchant.acceptOwned(ctx, orderId);
    }
    /** R1：商户送达校园交接点（之后由传信者接力） */
    async campusMerchantMarkHandoverArrived(ctx, orderId) {
        return this.merchant.markHandoverArrived(ctx, orderId);
    }
    /** 自营快递送达：R1/R2 到交接点，R3 到学生 */
    async campusMerchantMarkOwnedArrived(ctx, orderId) {
        return this.merchant.markOwnedArrived(ctx, orderId);
    }
};
exports.MerchantAdminResolver = MerchantAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantBoard", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantAcceptOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantCustomerContact", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantCookingDone", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantRejectOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('paused')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Boolean]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantSetPaused", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantMarkPrinted", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'search', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantProducts", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)('soldOut')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Boolean]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantSetProductSoldOut", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)({ name: 'packingFee', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantSetProductPackingFee", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)({ name: 'groups', type: () => [String] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantSetProductAddonGroups", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)({ name: 'combo', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantSetProductCombo", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantDispatchExternal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)({ name: 'reason', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantCancelExternal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantAcceptOwned", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantMarkHandoverArrived", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "campusMerchantMarkOwnedArrived", null);
exports.MerchantAdminResolver = MerchantAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [merchant_admin_service_1.MerchantAdminService])
], MerchantAdminResolver);
//# sourceMappingURL=merchant-admin.resolver.js.map