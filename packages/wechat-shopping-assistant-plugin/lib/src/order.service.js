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
exports.AssistantOrderService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 微信对话下单：
 * 选品（productId）→ 解析渠道默认变体（最低价有货）→ 建 Order 绑顾客 → 加购物车 → ArrangingPayment。
 * 绑顾客走 orderService.addCustomerToOrder（同步更新内存实体，ArrangingPayment 的
 * customer 守卫可见；裸 repo update 只落库、守卫读不到）。支付通过返回的订单号跳 H5 收银台。
 */
let AssistantOrderService = class AssistantOrderService {
    constructor(connection, orderService) {
        this.connection = connection;
        this.orderService = orderService;
    }
    async createOrder(ctx, customer, selections) {
        var _a, _b, _c, _d, _e;
        if (!selections.length) {
            return { status: 'error', message: '未选择商品' };
        }
        try {
            // 每个选品解析渠道默认变体；解析失败的跳过，全部失败则报错
            const variantPicks = [];
            for (const sel of selections) {
                const pick = await this.resolveDefaultVariant(ctx, sel.productId, String((_a = ctx.channelId) !== null && _a !== void 0 ? _a : ''));
                if (!pick) {
                    return { status: 'no_variant', title: sel.productId };
                }
                variantPicks.push(Object.assign(Object.assign({}, pick), { quantity: sel.quantity }));
            }
            const order = await this.orderService.create(ctx);
            await this.orderService.addCustomerToOrder(ctx, order, customer);
            const items = [];
            for (const pick of variantPicks) {
                const result = await this.orderService.addItemToOrder(ctx, order.id, pick.variant.id, pick.quantity);
                if ('errorCode' in result) {
                    if (result.errorCode === 'INSUFFICIENT_STOCK_ERROR') {
                        return { status: 'out_of_stock', title: pick.title };
                    }
                    return { status: 'error', message: result.message };
                }
                const line = result.lines.find(l => String(l.productVariant.id) === String(pick.variant.id));
                items.push({
                    title: pick.title,
                    quantity: pick.quantity,
                    price: (_c = (_b = line === null || line === void 0 ? void 0 : line.unitPrice) !== null && _b !== void 0 ? _b : pick.variant.listPrice) !== null && _c !== void 0 ? _c : 0,
                });
            }
            // 转入待支付（ArrangingPayment），由用户点击支付链接在 H5 收银台完成支付
            const arrangeResult = await this.orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
            if ('errorCode' in arrangeResult) {
                return { status: 'error', message: arrangeResult.message };
            }
            const finalOrder = await this.orderService.findOne(ctx, order.id, ['lines']);
            return {
                status: 'ok',
                order: finalOrder !== null && finalOrder !== void 0 ? finalOrder : order,
                items: items.length
                    ? items
                    : ((_d = finalOrder === null || finalOrder === void 0 ? void 0 : finalOrder.lines) !== null && _d !== void 0 ? _d : []).map(l => ({
                        title: l.productVariant.name,
                        quantity: l.quantity,
                        price: l.unitPrice,
                    })),
            };
        }
        catch (e) {
            core_1.Logger.error(`Assistant order creation failed: ${String(e)}`, constants_1.loggerCtx);
            return { status: 'error', message: String((_e = e.message) !== null && _e !== void 0 ? _e : e) };
        }
    }
    /**
     * 渠道默认变体：商品已发布 → 取该渠道有价格且启用、按价格升序的第一个变体。
     * 查询限定 channelId 匹配价格行，避免跨渠道下单。
     */
    async resolveDefaultVariant(ctx, productId, channelId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const product = await this.connection.getRepository(ctx, core_1.Product).findOne({
            where: { id: productId, enabled: true },
            relations: {
                translations: true,
                variants: { translations: true, productVariantPrices: true },
            },
        });
        if (!product)
            return null;
        const productTitle = (_d = (_b = (_a = product.translations.find(t => t.languageCode === ctx.languageCode)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : (_c = product.translations[0]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : `商品#${productId}`;
        const candidates = ((_e = product.variants) !== null && _e !== void 0 ? _e : [])
            .filter(v => v.enabled)
            .map(v => {
            var _a, _b, _c;
            return ({
                variant: v,
                price: (_c = (_b = (_a = v.productVariantPrices) === null || _a === void 0 ? void 0 : _a.find(p => Number(p.channelId) === Number(channelId))) === null || _b === void 0 ? void 0 : _b.price) !== null && _c !== void 0 ? _c : 0,
            });
        })
            .filter(x => x.price > 0)
            .sort((a, b) => a.price - b.price);
        if (!candidates.length)
            return null;
        const variant = candidates[0].variant;
        const variantTitle = (_j = (_g = (_f = variant.translations.find(t => t.languageCode === ctx.languageCode)) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : (_h = variant.translations[0]) === null || _h === void 0 ? void 0 : _h.name) !== null && _j !== void 0 ? _j : '';
        return { variant, title: variantTitle && variantTitle !== productTitle ? `${productTitle} ${variantTitle}` : productTitle };
    }
};
exports.AssistantOrderService = AssistantOrderService;
exports.AssistantOrderService = AssistantOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService])
], AssistantOrderService);
//# sourceMappingURL=order.service.js.map