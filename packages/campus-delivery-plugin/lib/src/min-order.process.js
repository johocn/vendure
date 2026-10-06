"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusMinOrderProcess = void 0;
exports.bindMinOrderConnection = bindMinOrderConnection;
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
/**
 * 起送价硬校验：拦截 → ArrangingPayment 过渡。
 * - 仅当渠道 campus 配置 minOrderAmount 非空时生效；
 * - orderKind='errand'（R5 跑腿单/接力单）豁免——跑腿费与小费不属于商品起送价；
 * - 不满足抛 UserInputError「未满起送价 ¥X」（X=元）。
 * connection 用模块级引用（与 shipping-calculator 同模式，onApplicationBootstrap 注入）。
 */
let connRef = null;
function bindMinOrderConnection(conn) {
    connRef = conn;
}
exports.campusMinOrderProcess = {
    async onTransitionStart(fromState, toState, { ctx, order }) {
        var _a, _b, _c;
        if (toState !== 'ArrangingPayment')
            return;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.orderKind === 'errand')
            return;
        const conn = connRef;
        if (!conn)
            return;
        const cfg = await conn.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        });
        if (!(cfg === null || cfg === void 0 ? void 0 : cfg.minOrderAmount))
            return;
        // 与 C 端软校验同口径：顾客可见的商品金额为含税小计（subTotalWithTax）
        if (((_c = (_b = order.subTotalWithTax) !== null && _b !== void 0 ? _b : order.subTotal) !== null && _c !== void 0 ? _c : 0) < cfg.minOrderAmount) {
            throw new core_1.UserInputError(`未满起送价 ¥${Number((cfg.minOrderAmount / 100).toFixed(2))}`);
        }
    },
};
//# sourceMappingURL=min-order.process.js.map