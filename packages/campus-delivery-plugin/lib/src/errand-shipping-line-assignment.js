"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusErrandShippingLineAssignmentStrategy = void 0;
/**
 * 校园插件 ShippingLine → OrderLine 分配策略（包装既有全局策略）。
 *
 * 背景：cjk-plugin 将全局 shippingLineAssignmentStrategy 覆盖为 BoxShippingLineAssignmentStrategy
 * （按「配送档案」分箱）。跑腿单的 0 元载体变体（CAMPUS-ERRAND-BASE）无档案绑定，回退租户默认
 * 档案后，该档案允许的配送方式不含跑腿方式 → 策略返回 [] → setShippingMethods 的 assignment
 * UPDATE 落空（WHERE 0=1）→ order_line.shippingLineId 不落库 → OrderService.save 级联 diff 把
 * 新 INSERT 的 ShippingLine 解绑成孤儿线（orderId=NULL），C 端拿到空 shippingLines。
 *
 * 跑腿单（customFields.orderKind='errand'）购物车仅含 0 元载体行，全部行都应挂到跑腿
 * ShippingLine，故直接全量分配；其余订单原样委托既有策略（Box / Default），行为不变。
 */
class CampusErrandShippingLineAssignmentStrategy {
    constructor(delegate) {
        this.delegate = delegate;
    }
    init(injector) {
        var _a, _b;
        // config.module 只对最终注册的策略调 init；Box 依赖 init 注入 ShippingProfileService，必须转发
        (_b = (_a = this.delegate).init) === null || _b === void 0 ? void 0 : _b.call(_a, injector);
    }
    async assignShippingLineToOrderLines(ctx, shippingLine, order) {
        var _a, _b;
        if (((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.orderKind) === 'errand') {
            return (_b = order.lines) !== null && _b !== void 0 ? _b : [];
        }
        return this.delegate.assignShippingLineToOrderLines(ctx, shippingLine, order);
    }
}
exports.CampusErrandShippingLineAssignmentStrategy = CampusErrandShippingLineAssignmentStrategy;
//# sourceMappingURL=errand-shipping-line-assignment.js.map