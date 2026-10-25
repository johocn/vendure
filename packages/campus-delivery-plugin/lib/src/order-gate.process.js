"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusOrderGateProcess = exports.BLACKLIST_MESSAGE = void 0;
exports.bindOrderGateConnection = bindOrderGateConnection;
exports.isBlacklisted = isBlacklisted;
exports.findSoldOutProductName = findSoldOutProductName;
const core_1 = require("@vendure/core");
const business_hours_1 = require("./business-hours");
/**
 * 下单前置闸门（进入 ArrangingPayment 时校验）：
 * 1) 店铺营业时间：Channel.customFields.waimaiBusinessHours 解析，打烊拦截（跑腿单豁免）；
 * 2) 黑名单：用户 / 手机号命中 active 记录即拦截；
 * 3) 商品沽清：订单行含已售罄商品（Product.customFields.waimaiSoldOut）即拦截。
 *
 * connection 用模块级引用（与 min-order.process / shipping-calculator 同模式）。
 */
let connRef = null;
function bindOrderGateConnection(conn) {
    connRef = conn;
}
exports.BLACKLIST_MESSAGE = '该账号暂不可下单，如有疑问请联系商家客服';
/** 黑名单校验：返回 true 表示命中（导出便于单测） */
async function isBlacklisted(conn, channelId, orderId) {
    var _a;
    const rows = await conn.rawConnection.query('SELECT c.id AS "customerId", c."phoneNumber" AS phone '
        + 'FROM "order" o JOIN customer c ON c.id = o."customerId" WHERE o.id = $1', [orderId]);
    const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const customer = list === null || list === void 0 ? void 0 : list[0];
    if (!customer)
        return false;
    const hit = await conn.rawConnection.query('SELECT 1 FROM campus_blacklist b WHERE b."channelId" = $1 AND b.active = true '
        + 'AND ((b.type = \'user\' AND b."customerId" = $2) OR (b.type = \'phone\' AND b.phone = $3)) LIMIT 1', [channelId, Number(customer.customerId), (_a = customer.phone) !== null && _a !== void 0 ? _a : null]);
    const hits = Array.isArray(hit) && Array.isArray(hit[0]) ? hit[0] : hit;
    return Array.isArray(hits) && hits.length > 0;
}
/** 沽清校验：返回首个售罄商品名（null=全部可售） */
async function findSoldOutProductName(conn, orderId) {
    var _a;
    const rows = await conn.rawConnection.query('SELECT pt.name FROM order_line ol '
        + 'JOIN product_variant pv ON pv.id = ol."productVariantId" '
        + 'JOIN product p ON p.id = pv."productId" '
        + 'LEFT JOIN product_translation pt ON pt."baseId" = p.id '
        + 'WHERE ol."orderId" = $1 AND COALESCE(p."customFieldsWaimaisoldout", false) = true '
        + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1', [orderId]);
    const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const name = (_a = list === null || list === void 0 ? void 0 : list[0]) === null || _a === void 0 ? void 0 : _a.name;
    return name == null ? null : String(name);
}
exports.campusOrderGateProcess = {
    async onTransitionStart(fromState, toState, { ctx, order }) {
        var _a, _b, _c;
        if (toState !== 'ArrangingPayment')
            return;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const isErrand = cf.orderKind === 'errand';
        // 1) 营业时间（跑腿单是平台跑腿服务，不受商家堂食营业时间约束）
        if (!isErrand) {
            const hours = ((_c = (_b = ctx.channel) === null || _b === void 0 ? void 0 : _b.customFields) !== null && _c !== void 0 ? _c : {}).waimaiBusinessHours;
            if (hours && !(0, business_hours_1.isWithinBusinessHours)(hours)) {
                throw new core_1.UserInputError(`店铺已打烊（营业时间 ${hours}），暂不可下单`);
            }
        }
        const conn = connRef;
        if (!conn)
            return;
        // 2) 黑名单
        if (await isBlacklisted(conn, Number(ctx.channelId), Number(order.id))) {
            throw new core_1.UserInputError(exports.BLACKLIST_MESSAGE);
        }
        // 3) 沽清
        const soldOut = await findSoldOutProductName(conn, Number(order.id));
        if (soldOut) {
            throw new core_1.UserInputError(`商品「${soldOut}」今日已售完，请重新选择`);
        }
    },
};
//# sourceMappingURL=order-gate.process.js.map