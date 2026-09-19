"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBindingService = setBindingService;
exports.getBindingService = getBindingService;
exports.isNewCustomer = isNewCustomer;
const core_1 = require("@vendure/core");
const coupon_runtime_1 = require("./coupon-runtime");
/**
 * 结算期需要访问商品绑券服务与订单历史统计。
 * Promotion 条件在结算同步路径里无法走 Nest 注入，照 coupon-runtime 的单例注入模式，
 * 在插件 onApplicationBootstrap 时注入。
 */
let bindingService;
function setBindingService(svc) {
    bindingService = svc;
}
function getBindingService() {
    if (!bindingService) {
        throw new Error('CouponPlugin CouponBindingService not initialized');
    }
    return bindingService;
}
/**
 * 新客判定：本租户无历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态）视为新客。
 * customerId 解析顺序：order.customer.id 优先，其次按 activeUserId 反查 Customer；
 * 均解析不到时视为新客。
 */
async function isNewCustomer(ctx, order) {
    var _a;
    let customerId = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.id;
    if (customerId == null && ctx.activeUserId != null) {
        const cust = await (0, coupon_runtime_1.getCouponConnection)()
            .getRepository(ctx, core_1.Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        customerId = cust === null || cust === void 0 ? void 0 : cust.id;
    }
    if (customerId == null)
        return true;
    const count = await (0, coupon_runtime_1.getCouponConnection)()
        .getRepository(ctx, core_1.Order)
        .createQueryBuilder('o')
        .where('o.customerId = :cid', { cid: customerId })
        .andWhere("o.state NOT IN ('Created','AddingItems','ArrangingPayment','Modifying','Cancelled')")
        .getCount();
    return count === 0;
}
//# sourceMappingURL=coupon-settlement.js.map