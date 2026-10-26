"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusAddonFeeProcess = exports.ADDON_FEE_LABEL = void 0;
exports.bindAddonFeeDeps = bindAddonFeeDeps;
const core_1 = require("@vendure/core");
const addon_fee_1 = require("./addon-fee");
/**
 * 加料费落账（P1-2）：→ ArrangingPayment 过渡时按行内加料引用汇总一条 order 级 surcharge。
 * - 与 campusPackingFeeProcess 同模式：跑腿单豁免；幂等（先按 sku 删旧再加新）；
 * - 金额不取前端上传值：OrderLine.customFields.waimaiAddons 只存 `[{g,n}]` 引用，
 *   单价一律按商品当前配置（waimaiAddonGroups）服务端解析，未知引用直接丢弃。
 */
let connRef = null;
let orderSvcRef = null;
function bindAddonFeeDeps(conn, orderService) {
    connRef = conn;
    orderSvcRef = orderService;
}
/** surcharge 展示名（C 端按 sku 本地化，后台/小票直接用该文案） */
exports.ADDON_FEE_LABEL = '加料费';
exports.campusAddonFeeProcess = {
    async onTransitionStart(fromState, toState, { ctx, order }) {
        var _a, _b, _c;
        if (toState !== 'ArrangingPayment')
            return;
        const conn = connRef;
        const orderService = orderSvcRef;
        if (!conn || !orderService)
            return;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.orderKind === 'errand')
            return;
        // 行与商品自定义字段必须重新加载：过渡回调传入的 order 未 join productVariant.product
        const full = await conn.getRepository(ctx, core_1.Order).findOne({
            where: { id: order.id },
            relations: ['lines', 'lines.productVariant', 'lines.productVariant.product', 'surcharges'],
        });
        if (!full)
            return;
        const existing = ((_b = full.surcharges) !== null && _b !== void 0 ? _b : []).filter(x => x.sku === addon_fee_1.ADDON_FEE_SKU);
        for (const s of existing) {
            await orderService.removeSurchargeFromOrder(ctx, full.id, s.id);
        }
        const fee = (0, addon_fee_1.quoteAddonFee)(((_c = full.lines) !== null && _c !== void 0 ? _c : []).map(line => {
            var _a, _b, _c, _d, _e;
            return ({
                addons: (_a = line.customFields) === null || _a === void 0 ? void 0 : _a.waimaiAddons,
                groups: (_d = (_c = (_b = line.productVariant) === null || _b === void 0 ? void 0 : _b.product) === null || _c === void 0 ? void 0 : _c.customFields) === null || _d === void 0 ? void 0 : _d.waimaiAddonGroups,
                quantity: Number((_e = line.quantity) !== null && _e !== void 0 ? _e : 0),
            });
        }));
        if (fee <= 0)
            return;
        await orderService.addSurchargeToOrder(ctx, full.id, {
            sku: addon_fee_1.ADDON_FEE_SKU,
            description: exports.ADDON_FEE_LABEL,
            listPrice: fee,
            listPriceIncludesTax: true,
        });
    },
};
//# sourceMappingURL=addon-fee.process.js.map