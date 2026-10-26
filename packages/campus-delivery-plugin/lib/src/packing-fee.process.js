"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusPackingFeeProcess = void 0;
exports.bindPackingFeeDeps = bindPackingFeeDeps;
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const packing_fee_1 = require("./packing-fee");
/**
 * 打包费/餐盒费落账（P1-1）：在 → ArrangingPayment 过渡时按最终购物车行重算一条 order 级 surcharge。
 * - 跑腿单（orderKind='errand'）豁免：跑腿费/小费不属于餐品打包；
 * - 幂等：先按 sku 标记移除本插件写入的旧打包费，再按最终件数写一条，避免改单/重试叠加；
 * - 商品级覆盖取 line.productVariant.product.customFields.waimaiPackingFee。
 * connection/orderService 由 plugin onApplicationBootstrap 注入（与 min-order.process 同模式）。
 */
let connRef = null;
let orderSvcRef = null;
function bindPackingFeeDeps(conn, orderService) {
    connRef = conn;
    orderSvcRef = orderService;
}
exports.campusPackingFeeProcess = {
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
        const cfg = await conn.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        });
        // 行与商品自定义字段必须重新加载：过渡回调传入的 order 未 join productVariant.product
        const full = await conn.getRepository(ctx, core_1.Order).findOne({
            where: { id: order.id },
            relations: ['lines', 'lines.productVariant', 'lines.productVariant.product', 'surcharges'],
        });
        if (!full)
            return;
        for (const s of ((_b = full.surcharges) !== null && _b !== void 0 ? _b : []).filter(x => x.sku === packing_fee_1.PACKING_FEE_SKU)) {
            await orderService.removeSurchargeFromOrder(ctx, full.id, s.id);
        }
        if (!cfg)
            return;
        const feeCfg = {
            enabled: cfg.packingFeeEnabled,
            mode: cfg.packingFeeMode,
            amount: cfg.packingFeeAmount,
            cap: cfg.packingFeeCap,
            label: cfg.packingFeeLabel,
        };
        if (!feeCfg.enabled)
            return;
        const fee = (0, packing_fee_1.quotePackingFee)(feeCfg, ((_c = full.lines) !== null && _c !== void 0 ? _c : []).map(line => {
            var _a, _b, _c, _d, _e;
            return ({
                packingFee: (_d = ((_c = (_b = (_a = line.productVariant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.customFields) === null || _c === void 0 ? void 0 : _c.waimaiPackingFee)) !== null && _d !== void 0 ? _d : null,
                quantity: Number((_e = line.quantity) !== null && _e !== void 0 ? _e : 0),
            });
        }));
        if (fee <= 0)
            return;
        await orderService.addSurchargeToOrder(ctx, full.id, {
            sku: packing_fee_1.PACKING_FEE_SKU,
            description: (0, packing_fee_1.resolvePackingFeeLabel)(feeCfg),
            listPrice: fee,
            listPriceIncludesTax: true,
        });
    },
};
//# sourceMappingURL=packing-fee.process.js.map