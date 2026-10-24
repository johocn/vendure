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
    '待处理 — 各环节订单数量与待接单单号（管理群为跨店视图）',
    '查 <单号> — 查询订单状态、骑手、异常与耗时',
    '异常 — 异常未处置 + 超时风险订单清单',
    '接单 <单号> — 商家接单',
    '出餐 <单号> — 出餐完成（进入大厅/待推送）',
    '拒单 <单号> <原因> — 需再次回复「确认拒单 <单号>」（店主）',
    '关店 <店铺> / 开店 <店铺> — 暂停或恢复接单（店主；店铺群可省略店铺）',
    '今日汇总 — 立即返回当天经营数据（管理群为全平台）',
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

// ---------- 平台管理群（跨店铺） ----------

export interface PlatformStoreLine {
    name: string;
    paused: boolean;
    pending: number;
    pendingCodes: string[];
    cooking: number;
    awaitingRider: number;
    delivering: number;
    pendingDispatch: number;
    thirdParty: number;
    ownedPool: number;
    ownedDispatched: number;
    merchantDelivering: number;
    completedToday: number;
    completedTodayAmount: number;
    exceptionCount: number;
}

function activeCount(s: PlatformStoreLine): number {
    return s.pending + s.cooking + s.awaitingRider + s.delivering + s.pendingDispatch
        + s.thirdParty + s.ownedPool + s.ownedDispatched + s.merchantDelivering;
}

export function formatPlatformBoard(input: {
    stores: PlatformStoreLine[];
    exceptions: string[];
    overdue: string[];
    at: number;
}): string {
    const { stores } = input;
    const lines = [`【跨店看板】${formatDateTime(input.at)}`];
    for (const s of stores) {
        const codes = s.pendingCodes.length ? `（${s.pendingCodes.join('、')}）` : '';
        lines.push(
            `· ${s.name} ${s.paused ? '已暂停' : '营业中'}｜待接单 ${s.pending}${codes}`
            + `｜备餐 ${s.cooking}｜待取 ${s.awaitingRider}｜配送 ${s.delivering}`
            + `｜待推外部 ${s.pendingDispatch}｜外部 ${s.thirdParty}`
            + `｜自营池 ${s.ownedPool}｜自营送 ${s.ownedDispatched}｜商户送 ${s.merchantDelivering}`
            + `｜异常 ${s.exceptionCount}`,
        );
    }
    const active = stores.reduce((n, s) => n + activeCount(s), 0);
    const done = stores.reduce((n, s) => n + s.completedToday, 0);
    const amount = stores.reduce((n, s) => n + s.completedTodayAmount, 0);
    lines.push(`合计：进行中 ${active} 单｜今日完成 ${done} 单 ¥${(amount / 100).toFixed(2)}`);
    if (input.exceptions.length) {
        lines.push(`【异常未处置 ${input.exceptions.length}】`);
        lines.push(...input.exceptions.slice(0, 8).map(t => `· ${t}`));
    }
    if (input.overdue.length) {
        lines.push(`【超时风险 ${input.overdue.length}】`);
        lines.push(...input.overdue.slice(0, 8).map(t => `· ${t}`));
    }
    return lines.join('\n');
}

export function formatExceptions(exceptions: string[], overdue: string[]): string {
    if (!exceptions.length && !overdue.length) return '当前没有异常或超时订单。';
    const lines: string[] = [];
    if (exceptions.length) {
        lines.push(`【异常未处置 ${exceptions.length}】`);
        lines.push(...exceptions.slice(0, 15).map(t => `· ${t}`));
    }
    if (overdue.length) {
        lines.push(`【超时风险 ${overdue.length}】`);
        lines.push(...overdue.slice(0, 15).map(t => `· ${t}`));
    }
    return lines.join('\n');
}

export interface PlatformDigestStore {
    name: string;
    completed: number;
    amount: number;
    onTimeRate: number;
    cancelled: number;
    exception: number;
}

export function formatPlatformDigest(input: {
    date: string;
    stores: PlatformDigestStore[];
    totalOrders: number;
    cancelled: number;
    completed: number;
    amount: number;
    onTimeRate: number;
    exception: number;
}): string {
    const lines = [`【每日汇总】${input.date} 全平台`];
    for (const s of input.stores) {
        lines.push(
            `· ${s.name} 完成 ${s.completed} 单 ¥${(s.amount / 100).toFixed(2)}`
            + `｜准点率 ${s.onTimeRate}%｜取消 ${s.cancelled}｜异常 ${s.exception}`,
        );
    }
    lines.push(
        `合计：订单 ${input.totalOrders}（取消 ${input.cancelled}）`
        + `、完成 ${input.completed} 单 ¥${(input.amount / 100).toFixed(2)}`
        + `、准点率 ${input.onTimeRate}%、异常未处置 ${input.exception}`,
    );
    return lines.join('\n');
}

export interface OrderStatusInput {
    code: string;
    store: string;
    orderState: string;
    hallStatus?: string | null;
    deliveryStatus?: string | null;
    route?: string | null;
    riderName?: string | null;
    building?: string | null;
    zone?: string | null;
    slotText?: string | null;
    total?: number;
    exceptionType?: string | null;
    exceptionNote?: string | null;
    exceptionMinutes?: number | null;
    createdAt: number;
    at: number;
}

const HALL_LABEL: Record<string, string> = {
    scheduled: '预约待放量',
    pending_merchant: '待商户接单',
    accepted: '备餐中',
    open: '待抢单',
    grabbed: '骑手已接单',
    pending_dispatch: '待推外部快递',
    third_party: '外部快递配送中',
    owned_pool: '待自营接单',
    owned_dispatched: '自营配送中',
    merchant_delivering: '商户送往交接点',
    exception: '异常待处置',
};

const DELIVERY_LABEL: Record<string, string> = {
    assigned: '已派单未取货',
    picked: '已取货',
    delivering: '配送中',
    delivered: '已送达',
    exception: '异常',
};

export function formatOrderStatus(o: OrderStatusInput): string {
    const hall = o.hallStatus ? HALL_LABEL[o.hallStatus] ?? o.hallStatus : '未进入配送流程';
    const delivery = o.deliveryStatus ? DELIVERY_LABEL[o.deliveryStatus] ?? o.deliveryStatus : null;
    const lines = [`【订单 ${o.code}】${o.store}`];
    lines.push(`订单状态：${o.orderState}｜配送环节：${hall}${delivery ? `（${delivery}）` : ''}`);
    if (o.route) lines.push(`配送路线：${o.route}${o.riderName ? `｜骑手：${o.riderName}` : ''}`);
    else if (o.riderName) lines.push(`骑手：${o.riderName}`);
    const addr = [o.building, o.zone, o.slotText].filter(Boolean).join(' ');
    if (addr) lines.push(`送达信息：${addr}`);
    if (typeof o.total === 'number') lines.push(`订单金额：¥${(o.total / 100).toFixed(2)}`);
    if (o.exceptionType || o.exceptionNote) {
        const mins = o.exceptionMinutes != null ? `（已上报 ${o.exceptionMinutes} 分钟）` : '';
        lines.push(`异常：${[o.exceptionType, o.exceptionNote].filter(Boolean).join('｜')}${mins}`);
    }
    lines.push(`下单时间：${formatDateTime(o.createdAt)}｜已过 ${Math.max(0, Math.round((o.at - o.createdAt) / 60_000))} 分钟`);
    return lines.join('\n');
}
