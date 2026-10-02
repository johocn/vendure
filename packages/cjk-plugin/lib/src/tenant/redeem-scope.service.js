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
exports.RedeemScopeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const tenant_member_entity_1 = require("./tenant-member.entity");
/**
 * 到店核销范围判定（受限核销员 = 持有 VerifyOrder 权限）。
 *
 * 判定链见 spec §3：
 *   不受限 → 全量；受限 → 读 TenantMember.shippingProfileIds，
 *   空白名单 = 默认拒绝；非空则要求「全部命中」（订单所有行 / 券模板所有关联商品）。
 *
 * 本服务在插件 onApplicationBootstrap 中经 setRedeemScopeResolver 注册给 coupon-plugin
 * （依赖方向 cjk → coupon，避免成环）。
 */
let RedeemScopeService = class RedeemScopeService {
    constructor(connection) {
        this.connection = connection;
    }
    async resolve(ctx) {
        var _a;
        if (!ctx.userHasPermissions([coupon_plugin_1.VERIFY_ORDER_PERMISSION])) {
            return { restricted: false, shippingProfileIds: [] };
        }
        const member = await this.findMember(ctx);
        return {
            restricted: true,
            shippingProfileIds: ((_a = member === null || member === void 0 ? void 0 : member.shippingProfileIds) !== null && _a !== void 0 ? _a : []).map(String),
        };
    }
    /** 订单侧：订单所有商品行的档案都须落在白名单内；任一行缺失或越界即拒绝 */
    async orderInScope(ctx, orderId, scope) {
        var _a;
        if (!scope.restricted) {
            return true;
        }
        const allow = new Set(scope.shippingProfileIds.map(String));
        if (allow.size === 0) {
            return false;
        }
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: Number(orderId) },
            relations: { lines: { productVariant: true } },
        });
        if (!order || !((_a = order.lines) === null || _a === void 0 ? void 0 : _a.length)) {
            return false;
        }
        return order.lines.every(line => {
            var _a, _b;
            const profileId = (_b = (_a = line.productVariant) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.shippingProfileId;
            return profileId != null && allow.has(String(profileId));
        });
    }
    /** 券侧：券模板须有绑定记录，且所有绑定关联商品/变体的档案都落在白名单内；通用券一律拒绝 */
    async couponTemplateInScope(ctx, templateId, scope) {
        if (!scope.restricted) {
            return true;
        }
        const allow = new Set(scope.shippingProfileIds.map(String));
        if (allow.size === 0) {
            return false;
        }
        const bindings = await this.connection.getRepository(ctx, coupon_plugin_1.ProductCouponBinding).find({
            where: { couponTemplateId: Number(templateId) },
        });
        if (bindings.length === 0) {
            return false;
        }
        const variantIds = [];
        for (const binding of bindings) {
            const ids = await this.resolveBindingVariantIds(ctx, binding);
            if (ids.length === 0) {
                return false;
            }
            variantIds.push(...ids);
        }
        if (variantIds.length === 0) {
            return false;
        }
        const variants = await this.connection.getRepository(ctx, core_1.ProductVariant).find({
            where: { id: (0, typeorm_1.In)(variantIds) },
        });
        const profileByVariant = new Map(variants.map(v => { var _a, _b; return [Number(v.id), ((_b = (_a = v.customFields) === null || _a === void 0 ? void 0 : _a.shippingProfileId) !== null && _b !== void 0 ? _b : null)]; }));
        return variantIds.every(id => {
            const profileId = profileByVariant.get(id);
            return profileId != null && allow.has(String(profileId));
        });
    }
    /** 绑定未细化 variantIds 时，取该商品的全部变体 */
    async resolveBindingVariantIds(ctx, binding) {
        var _a;
        if ((_a = binding.variantIds) === null || _a === void 0 ? void 0 : _a.length) {
            return binding.variantIds.map(Number);
        }
        const variants = await this.connection.getRepository(ctx, core_1.ProductVariant).find({
            where: { product: { id: binding.productId } },
            select: { id: true },
        });
        return variants.map(v => Number(v.id));
    }
    /** 当前登录人 × 当前租户的人员记录（channelId = 登录租户） */
    async findMember(ctx) {
        const userId = ctx.activeUserId;
        if (userId == null) {
            return null;
        }
        const admin = await this.connection.getRepository(ctx, core_1.Administrator).findOne({
            where: { user: { id: userId } },
            select: { id: true },
        });
        if (!admin) {
            return null;
        }
        return this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember).findOne({
            where: { administratorId: String(admin.id), channelId: String(ctx.channelId) },
        });
    }
};
exports.RedeemScopeService = RedeemScopeService;
exports.RedeemScopeService = RedeemScopeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RedeemScopeService);
//# sourceMappingURL=redeem-scope.service.js.map