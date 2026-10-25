"use strict";
/**
 * 意图识别：纯函数规则引擎（无 IO，可独立单测）。
 * 覆盖「买一瓶酱油」类搜索、「买1/1」编号下单、帮助、绑定引导等场景。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeInput = normalizeInput;
exports.parseOrderIndices = parseOrderIndices;
exports.recognizeIntent = recognizeIntent;
exports.buildDedupKey = buildDedupKey;
const HELP_RE = /^(帮助|菜单|功能|怎么用|使用帮助|help|hi|hello|你好|您好)[!！。.~]?$/i;
const BIND_RE = /^(绑定|登录|注册|账号|帐号)([!！。.~]?)/;
const ADDR_MANAGE_RE = /^(地址管理|我的地址|地址簿|收货地址|管理地址)[!！。.~]?$/;
const ADDR_ADD_RE = /^(新增地址|添加地址|新增|添加)[!！。.~]?$/;
const NEARBY_STORES_RE = /^(附近门店|最近门店|周围门店|门店列表|附近)[!！。.~]?$/;
/** 一键客服同义词（含「客服2」按候选门店选择） */
const SUPPORT_RE = /^(客服|人工|人工客服|转人工|联系店家|找店长|找店家|有问题|投诉|售后)[!！。.~]?$/;
const SUPPORT_STORE_RE = /^客服(\d{1,2})[!！。.~]?$/;
/** 留言工单入口（下一句作为留言正文） */
const SUPPORT_NOTE_RE = /^(留言|给门店留言|意见反馈|反馈|建议|意见建议)[!！。.~]?$/;
const ORDER_HEAD = '(?:购买|下单|订购|买|要|来|购|拍)?';
const SEARCH_HEAD = '(?:搜索|查询|想买|想要|看看|推荐|买|要|来|找|搜|查)';
const QTY_UNIT = '(?:个|件|瓶|包|盒|罐|袋|听|支|条|份|箱|斤|克|毫升|升)';
/** 全角数字/字母转半角，去空白，统一分隔符 */
function normalizeInput(raw) {
    return (raw || '')
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\s+/g, '')
        .trim();
}
/** 「1,3」「1和3」「1 3」→ [1,3]；编号合法范围 1-99 */
function parseOrderIndices(text) {
    const parts = text.split(/[,，、和&]/);
    const indices = [];
    for (const part of parts) {
        if (!/^\d{1,2}$/.test(part))
            return null;
        const n = Number(part);
        if (n < 1)
            return null;
        indices.push(n);
    }
    return indices.length ? indices : null;
}
function recognizeIntent(raw) {
    const text = normalizeInput(raw);
    if (!text)
        return { kind: 'help' };
    if (HELP_RE.test(text))
        return { kind: 'help' };
    if (BIND_RE.test(text))
        return { kind: 'bind' };
    // 地址指令优先于搜索兜底（「地址簿」等词否则会被当搜索词）
    if (ADDR_MANAGE_RE.test(text))
        return { kind: 'address_manage' };
    if (ADDR_ADD_RE.test(text))
        return { kind: 'address_add' };
    if (NEARBY_STORES_RE.test(text))
        return { kind: 'nearby_stores' };
    // 客服为全局指令：放在搜索兜底之前，任何状态下都能直达
    if (SUPPORT_RE.test(text))
        return { kind: 'support' };
    const supportStore = text.match(SUPPORT_STORE_RE);
    if (supportStore)
        return { kind: 'support', storeIndex: Number(supportStore[1]) };
    if (SUPPORT_NOTE_RE.test(text))
        return { kind: 'support_note' };
    // 编号下单：纯编号或「买/来/下单 + 编号（可多个，支持分隔符）」
    const orderMatch = text.match(new RegExp(`^${ORDER_HEAD}(\\d{1,2}(?:[,，、和&]\\d{1,2})*)(?:号|楼)?$`));
    if (orderMatch) {
        const indices = parseOrderIndices(orderMatch[1]);
        if (indices)
            return { kind: 'order', indices };
    }
    // 「买2瓶酱油」→ 数量 + 关键词搜索（SEARCH_HEAD/QTY_UNIT 均为非捕获组：[1]=数字 [2]=关键词）
    const qtyMatch = text.match(new RegExp(`^${SEARCH_HEAD}(\\d{1,3})${QTY_UNIT}(.+)$`));
    if (qtyMatch && Number(qtyMatch[1]) > 0) {
        return { kind: 'search', query: qtyMatch[2], quantity: Number(qtyMatch[1]) };
    }
    // 去掉引导动词后搜索；无动词直接模糊搜索
    const searchMatch = text.match(new RegExp(`^${SEARCH_HEAD}(.+)$`));
    return { kind: 'search', query: searchMatch ? searchMatch[1] : text };
}
/** 入站消息去重键：MsgId 优先；事件类消息用 from:createTime:event 组合 */
function buildDedupKey(msg) {
    var _a, _b;
    if (msg.msgId)
        return `mid:${msg.msgId}`;
    return `evt:${msg.fromUserName}:${(_a = msg.createTime) !== null && _a !== void 0 ? _a : ''}:${(_b = msg.event) !== null && _b !== void 0 ? _b : msg.msgType}`;
}
//# sourceMappingURL=intent.js.map