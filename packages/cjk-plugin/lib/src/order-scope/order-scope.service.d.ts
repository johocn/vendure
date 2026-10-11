import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { RedeemScope } from '@vendure/coupon-plugin';
import { RedeemScopeService } from '../tenant/redeem-scope.service';
/** 前端语义过滤入参（时间为已解析的半开区间） */
export interface ScopedOrderFilter {
    states?: string[];
    /** createdAt >= start（ISO，含） */
    timeStart?: string;
    /** createdAt < end（ISO，不含） */
    timeEnd?: string;
    keyword?: string;
    deliveryType?: string;
    exceptionType?: string;
    exceptionOnly?: boolean;
    afterSales?: string[];
}
export interface ScopedOrderList {
    totalItems: number;
    items: Order[];
}
export interface NewOrderSignal {
    count: number;
    /** 过滤范围内最大 orderPlacedAt（ISO），无单为 null */
    latestPlacedAt: string | null;
}
/**
 * 受限核销员「按配送档案」的订单查询/计数/新单信号服务。
 *
 * 范围判定：超管恒不受限；其余复用 RedeemScopeService（持有 VerifyOrder
 * 权限 → 以 TenantMember.shippingProfileIds 为白名单）。受限时要求订单
 * 所有商品行的 productVariant.customFields.shippingProfileId 都落在白名单
 * 内（任一行缺失或越界 → 整单排除；无行订单排除），与
 * RedeemScopeService.orderInScope 语义一致，只是下推为 QB 谓词。
 */
export declare class OrderScopeService {
    private connection;
    private redeemScopeService;
    constructor(connection: TransactionalConnection, redeemScopeService: RedeemScopeService);
    /** 超管恒不受限；其余复用 RedeemScopeService（VerifyOrder → 白名单） */
    resolveScope(ctx: RequestContext): Promise<RedeemScope>;
    /** 受限：叠加「全部行档案 ∈ 白名单」谓词（与 RedeemScopeService.orderInScope 语义一致） */
    private applyScope;
    private applyFilter;
    private baseQb;
    scopedOrders(ctx: RequestContext, filter: ScopedOrderFilter, take: number, skip: number): Promise<ScopedOrderList>;
    /** N 组计数（每条独立 QB，参数互不冲突）；异常向上抛由前端保留旧值 */
    scopedOrderCounts(ctx: RequestContext, filters: ScopedOrderFilter[]): Promise<number[]>;
    /**
     * 新单信号：since 之后下单数 + 范围内最大 orderPlacedAt
     *
     * 时区口径（dev 实测定性，勿改回 toISOString() 字符串传参）：
     * 列形态为 timestamp without time zone 且存本地字面（本地 17:40 建单 → 列字面 2026-10-11 17:40:39）。
     * since 以 Date 对象直传：pg 驱动按连接时区序列化为「本地字面+偏移」（实测 2026-10-11T09:40:39.209Z
     * → '2026-10-11T17:40:39.209+08:00'），PG 解析时丢偏移取字面 = 本地日历字面，与列字面对齐；
     * 若传 toISOString() 字符串则被丢 Z 按 UTC 字面比较 → 窗口整体早 8h → 同批单反复命中。
     * 谓词用严格大于：排除「构成上次锚点的最后一单」（含等于会让 count 恒多 1，前端 unread 重复累加）。
     */
    newOrderSignal(ctx: RequestContext, since: Date): Promise<NewOrderSignal>;
}
