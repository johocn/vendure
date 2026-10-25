/**
 * 意图识别：纯函数规则引擎（无 IO，可独立单测）。
 * 覆盖「买一瓶酱油」类搜索、「买1/1」编号下单、帮助、绑定引导等场景。
 */
export type AssistantIntent = {
    kind: 'search';
    query: string;
    quantity?: number;
} | {
    kind: 'order';
    indices: number[];
} | {
    kind: 'help';
} | {
    kind: 'bind';
} | {
    kind: 'address_manage';
} | {
    kind: 'address_add';
} | {
    kind: 'nearby_stores';
}
/** 一键客服：任何状态下生效，storeIndex 用于「客服2」选定候选门店 */
 | {
    kind: 'support';
    storeIndex?: number;
};
/** 全角数字/字母转半角，去空白，统一分隔符 */
export declare function normalizeInput(raw: string): string;
/** 「1,3」「1和3」「1 3」→ [1,3]；编号合法范围 1-99 */
export declare function parseOrderIndices(text: string): number[] | null;
export declare function recognizeIntent(raw: string): AssistantIntent;
/** 入站消息去重键：MsgId 优先；事件类消息用 from:createTime:event 组合 */
export declare function buildDedupKey(msg: {
    msgId?: string;
    fromUserName: string;
    createTime?: number;
    event?: string;
    msgType: string;
}): string;
