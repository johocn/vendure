"use strict";
/** 飞书消息文案（纯函数，便于单测；不含 emoji，保持运维群阅读清爽） */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HELP_TEXT = void 0;
exports.formatPush = formatPush;
exports.formatDateTime = formatDateTime;
exports.formatBoard = formatBoard;
exports.formatDigest = formatDigest;
const SCENE_LABEL = {
    shop_new_order: '新订单',
    after_sales: '售后',
    exception: '异常/超时',
    payment_timeout: '支付超时',
    digest: '每日汇总',
};
function formatPush(input) {
    var _a;
    const label = (_a = SCENE_LABEL[input.scene]) !== null && _a !== void 0 ? _a : input.scene;
    const lines = [`【${label}】${input.title}`];
    if (input.orderCode)
        lines.push(`订单：${input.orderCode}`);
    if (input.content)
        lines.push(input.content);
    if (input.at)
        lines.push(`时间：${formatDateTime(input.at)}`);
    if (input.link)
        lines.push(`详情：${input.link}`);
    return lines.join('\n');
}
function formatDateTime(at) {
    const d = new Date(at + 8 * 3600000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
exports.HELP_TEXT = [
    '可用指令：',
    '待处理 — 查看各环节订单数量与待接单单号',
    '接单 <单号> — 商家接单',
    '出餐 <单号> — 出餐完成（进入大厅/待推送）',
    '拒单 <单号> <原因> — 需再次回复「确认拒单 <单号>」（店主）',
    '关店 / 开店 — 暂停或恢复接单（店主）',
    '今日汇总 — 立即返回当天经营数据',
    '帮助 — 显示本清单',
].join('\n');
function formatBoard(board) {
    var _a, _b, _c, _d, _e, _f;
    const codes = (list) => (list !== null && list !== void 0 ? list : []).slice(0, 5).map(o => o.code).filter(Boolean).join('、');
    const lines = [`【${board.storeName || '店铺'}】营业状态：${board.paused ? '已暂停' : '营业中'}`];
    lines.push(`待接单 ${board.pending.length}${codes(board.pending) ? `（${codes(board.pending)}）` : ''}`);
    lines.push(`备餐中 ${board.cooking.length}`);
    lines.push(`待取货 ${board.awaitingRider.length}`);
    lines.push(`配送中 ${board.delivering.length}`);
    if (((_b = (_a = board.pendingDispatch) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0)
        lines.push(`待推外部 ${(_c = board.pendingDispatch) === null || _c === void 0 ? void 0 : _c.length}`);
    if (((_e = (_d = board.thirdParty) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > 0)
        lines.push(`外部配送 ${(_f = board.thirdParty) === null || _f === void 0 ? void 0 : _f.length}`);
    lines.push(`今日已完成 ${board.completedToday} 单，金额 ¥${(board.completedTodayAmount / 100).toFixed(2)}`);
    return lines.join('\n');
}
function formatDigest(d) {
    const lines = [`【每日汇总】${d.date} ${d.storeName || ''}`.trim()];
    lines.push(`订单量 ${d.totalOrders}（取消 ${d.cancelled}）`);
    lines.push(`完成 ${d.completedToday} 单，金额 ¥${(d.completedTodayAmount / 100).toFixed(2)}`);
    lines.push(`准点率 ${d.onTimeRate}%`);
    lines.push(`当前待接单 ${d.pending.length}、备餐中 ${d.cooking.length}、配送中 ${d.delivering.length}`);
    lines.push(`异常未处置 ${d.exceptionCount}`);
    lines.push(`营业状态：${d.paused ? '已暂停' : '营业中'}`);
    return lines.join('\n');
}
//# sourceMappingURL=feishu.templates.js.map