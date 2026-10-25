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
/** 支付方式查询（按渠道配置列出） */
const PAYMENT_METHODS_RE = /^(支付方式|付款方式|支付渠道|怎么付款|怎么支付|能怎么付|可以怎么付)[!！。.~?？]?$/;
const ORDER_HEAD = '(?:购买|下单|订购|买|要|来|购|拍)?';
const SEARCH_HEAD = '(?:帮我找|帮我搜|帮我|麻烦|请)?(?:搜索|查询|想买|想要|看看|推荐|买|要|来|找|搜|查)';
const QTY_UNIT = '(?:个|件|瓶|包|盒|罐|袋|听|支|条|份|箱|斤|克|毫升|升)';
/** 无数字时也安全剥离的计量词（排除「包子」「个旧」等可能作商品名前缀的字） */
const BARE_QTY_UNIT = '(?:袋|箱|桶|提|瓶|罐|盒|听|升|斤|克|毫升)';
const CN_NUM = '一二两三四五六七八九十';
/** 中文数字转阿拉伯数字（支持 一~九十九；无法识别返回 0） */
function parseCnNumber(raw) {
    var _a, _b, _c;
    const single = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (!raw)
        return 0;
    const tenIdx = raw.indexOf('十');
    if (tenIdx < 0)
        return (_a = single[raw]) !== null && _a !== void 0 ? _a : 0;
    const tens = tenIdx === 0 ? 1 : (_b = single[raw[tenIdx - 1]]) !== null && _b !== void 0 ? _b : 0;
    const onesRaw = raw.slice(tenIdx + 1);
    const ones = onesRaw ? (_c = single[onesRaw]) !== null && _c !== void 0 ? _c : 0 : 0;
    return tens * 10 + ones;
}
/**
 * 拆出「数量 + 单位 + 关键词」：
 * 「2袋面」「一袋面」「买袋面」「袋面」都能剥离计量词，避免「袋面」直接进检索；
 * 未写数量时按 1 计量（quantity=1），未带单位时保持原样。
 */
function splitQuantity(text) {
    const unit = new RegExp(`^(\\d{1,3})(?:${QTY_UNIT})(.*)$`).exec(text);
    if (unit) {
        const qty = Number(unit[1]);
        const rest = unit[2].trim().replace(/^装/, '');
        if (rest)
            return { query: rest, quantity: qty };
    }
    const cn = new RegExp(`^([${CN_NUM}]{1,3})(?:${QTY_UNIT})(.*)$`).exec(text);
    if (cn) {
        const qty = parseCnNumber(cn[1]);
        const rest = cn[2].trim().replace(/^装/, '');
        if (rest && qty > 0)
            return { query: rest, quantity: qty };
    }
    const bare = new RegExp(`^(?:${BARE_QTY_UNIT})(.*)$`).exec(text);
    if (bare) {
        const rest = bare[1].trim().replace(/^装/, '');
        if (rest)
            return { query: rest, quantity: 1 };
    }
    return { query: text };
}
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
    if (PAYMENT_METHODS_RE.test(text))
        return { kind: 'payment_methods' };
    // 编号下单：纯编号或「买/来/下单 + 编号（可多个，支持分隔符）」
    const orderMatch = text.match(new RegExp(`^${ORDER_HEAD}(\\d{1,2}(?:[,，、和&]\\d{1,2})*)(?:号|楼)?$`));
    if (orderMatch) {
        const indices = parseOrderIndices(orderMatch[1]);
        if (indices)
            return { kind: 'order', indices };
    }
    // 去掉引导动词后拆「数量+单位」：「买2瓶酱油」「买袋面」「一袋面」都归一到商品关键词
    const searchMatch = text.match(new RegExp(`^${SEARCH_HEAD}(.+)$`));
    const body = searchMatch ? searchMatch[1] : text;
    const { query, quantity } = splitQuantity(body);
    return quantity != null
        ? { kind: 'search', query, quantity }
        : { kind: 'search', query };
}
/** 入站消息去重键：MsgId 优先；事件类消息用 from:createTime:event 组合 */
function buildDedupKey(msg) {
    var _a, _b;
    if (msg.msgId)
        return `mid:${msg.msgId}`;
    return `evt:${msg.fromUserName}:${(_a = msg.createTime) !== null && _a !== void 0 ? _a : ''}:${(_b = msg.event) !== null && _b !== void 0 ? _b : msg.msgType}`;
}
//# sourceMappingURL=intent.js.map