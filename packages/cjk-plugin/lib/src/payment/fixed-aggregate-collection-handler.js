"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixedAggregateCollectionHandler = void 0;
const core_1 = require("@vendure/core");
/**
 * 固定聚合码收款处理器（门店到店收银）
 *
 * 门店到店收银：顾客扫码商家固定的聚合收款码（微信/支付宝）付款到商户，
 * 店员确认到账后完成订单。离线自确认，不经第三方网关回调，与到店收银一致。
 */
exports.fixedAggregateCollectionHandler = new core_1.PaymentMethodHandler({
    code: 'fixed-aggregate-collection',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '固定聚合码收款' },
        { languageCode: core_1.LanguageCode.en, value: 'Fixed Aggregate QR Collection' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized',
            transactionId: `FIXED-AGG-${order.code}`,
            metadata: { method: 'fixed-aggregate-collection' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});
//# sourceMappingURL=fixed-aggregate-collection-handler.js.map