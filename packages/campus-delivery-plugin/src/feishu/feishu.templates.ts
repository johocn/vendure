/** 飞书消息文案（纯函数，便于单测；不含 emoji，保持运维群阅读清爽） */

export interface PushInput {
    scene: string;
    title: string;
    content: string;
    orderCode?: string;
    link?: string;
    at?: number;
}

const SCENE_LABEL: Record<string, string> = {
    shop_new_order: '新订单',
    after_sales: '售后',
    exception: '异常/超时',
    payment_timeout: '支付超时',
    digest: '每日汇总',
};

export function formatPush(input: PushInput): string {
    const label = SCENE_LABEL[input.scene] ?? input.scene;
    const lines = [`【${label}】${input.title}`];
    if (input.orderCode) lines.push(`订单：${input.orderCode}`);
    if (input.content) lines.push(input.content);
    if (input.at) lines.push(`时间：${formatDateTime(input.at)}`);
    if (input.link) lines.push(`详情：${input.link}`);
    return lines.join('\n');
}

export function formatDateTime(at: number): string {
    const d = new Date(at + 8 * 3600_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export const HELP_TEXT = [
    '可用指令：',
    '待处理 — 查看各环节订单数量与待接单单号',
    '接单 <单号> — 商家接单',
    '出餐 <单号> — 出餐完成（进入大厅/待推送）',
    '拒单 <单号> <原因> — 需再次回复「确认拒单 <单号>」（店主）',
    '关店 / 开店 — 暂停或恢复接单（店主）',
    '今日汇总 — 立即返回当天经营数据',
    '帮助 — 显示本清单',
].join('\n');

export interface BoardLike {
    paused: boolean;
    storeName?: string;
    pending: Array<{ code?: string }>;
    cooking: Array<{ code?: string }>;
    awaitingRider: Array<{ code?: string }>;
    delivering: Array<{ code?: string }>;
    pendingDispatch?: Array<{ code?: string }>;
    thirdParty?: Array<{ code?: string }>;
    completedToday: number;
    completedTodayAmount: number;
}

export function formatBoard(board: BoardLike): string {
    const codes = (list?: Array<{ code?: string }>) =>
        (list ?? []).slice(0, 5).map(o => o.code).filter(Boolean).join('、');
    const lines = [`【${board.storeName || '店铺'}】营业状态：${board.paused ? '已暂停' : '营业中'}`];
    lines.push(`待接单 ${board.pending.length}${codes(board.pending) ? `（${codes(board.pending)}）` : ''}`);
    lines.push(`备餐中 ${board.cooking.length}`);
    lines.push(`待取货 ${board.awaitingRider.length}`);
    lines.push(`配送中 ${board.delivering.length}`);
    if ((board.pendingDispatch?.length ?? 0) > 0) lines.push(`待推外部 ${board.pendingDispatch?.length}`);
    if ((board.thirdParty?.length ?? 0) > 0) lines.push(`外部配送 ${board.thirdParty?.length}`);
    lines.push(`今日已完成 ${board.completedToday} 单，金额 ¥${(board.completedTodayAmount / 100).toFixed(2)}`);
    return lines.join('\n');
}

export interface DigestInput extends BoardLike {
    date: string;
    totalOrders: number;
    onTimeRate: number;
    cancelled: number;
    exceptionCount: number;
}

export function formatDigest(d: DigestInput): string {
    const lines = [`【每日汇总】${d.date} ${d.storeName || ''}`.trim()];
    lines.push(`订单量 ${d.totalOrders}（取消 ${d.cancelled}）`);
    lines.push(`完成 ${d.completedToday} 单，金额 ¥${(d.completedTodayAmount / 100).toFixed(2)}`);
    lines.push(`准点率 ${d.onTimeRate}%`);
    lines.push(`当前待接单 ${d.pending.length}、备餐中 ${d.cooking.length}、配送中 ${d.delivering.length}`);
    lines.push(`异常未处置 ${d.exceptionCount}`);
    lines.push(`营业状态：${d.paused ? '已暂停' : '营业中'}`);
    return lines.join('\n');
}
